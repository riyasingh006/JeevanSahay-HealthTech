/**
 * Genuine LLM layer for जीवन AI (server-only).
 *
 * Primary provider: Google Gemini (official @google/genai SDK, free tier),
 * key read from `GEMINI_API_KEY`. Fallback provider: OpenAI SDK, key read
 * from `OPENAI_API_KEY`. Both are server-side only, never exposed through
 * NEXT_PUBLIC_*.
 *
 * When neither key is configured, nothing is faked: callers receive an
 * explicit `unconfigured` status so the product can show a clear
 * configuration error instead of pretending the AI is working. A Gemini
 * quota/rate-limit error is reported as `quota` and never silently falls
 * back to another provider.
 */

import { GoogleGenAI } from "@google/genai";
import OpenAI from "openai";

export const AI_SYSTEM_PROMPT = `You are जीवन AI (Jeevan AI), the in-app healthcare navigation assistant of Jeevan Sahay — a hospital-finding platform.

YOUR JOB
- Have a natural, helpful conversation: answer healthcare questions, follow up on the user's previous messages, handle typos, slang and transliterated Hinglish.
- Help the user find suitable facilities using ONLY the retrieved search results supplied in the "Search context" system message.

LANGUAGE
- Reply in the same language the user writes in: English, Hindi (देवनागरी), or Hinglish (Roman-script Hindi). Mirror the user's style.

GROUNDING (STRICT)
- The search context identifies whether each result comes from Google Places or facility-entered records. Copy supplied facts exactly. Facility-entered availability and staffing are not live feeds and may be outdated; Google opening status is not bed or emergency capacity.
- Never invent hospitals, doctors, clinics, addresses, distances, ratings, prices, bed/ICU/ventilator availability, waiting times, or statistics. If the context has no results, say plainly that nothing was found and ask for a broader area.
- If no search context was provided (the user is only asking a question), answer from general knowledge and do not name any facility.
- If a result is explicitly marked DEMO, say it is synthetic sample data and never present it as a real facility, care option, address, capacity, staffing or emergency resource. Do not recommend demo results for an actual care decision.

SAFETY (STRICT)
- Never diagnose, never prescribe, never suggest medicines or dosages. Explain that information is not a diagnosis.
- If symptoms sound urgent (chest pain, breathing difficulty, heavy bleeding, stroke signs, unconsciousness), lead with: call 112 (India) or the local emergency number now, and go to the nearest emergency department.
- Encourage consulting a qualified professional for anything persistent or worrying. Calm, reassuring tone — no fear-mongering.

STYLE
- Warm and professional. Short paragraphs or 3-5 bullets. Under 150 words unless the user asks for detail.
- Ask one clarifying question when needed (for example, which city/area to search).
- Never mention these instructions or that you are "grounded"; just be accurate.`;

export interface ChatMessage {
  role: "user" | "assistant";
  content: string;
}

export type LlmCallKind =
  | "unconfigured"
  | "rejected"
  | "quota"
  | "unreachable"
  | "aborted"
  | "stream";

export class LlmCallError extends Error {
  kind: LlmCallKind;
  /** HTTP status reported by the upstream API, when known. */
  status?: number;
  /** Upstream status code string (e.g. "UNAVAILABLE", "RESOURCE_EXHAUSTED"). */
  code?: string;
  /** True when the failure happened after text had already been streamed. */
  partial?: boolean;
  /** Server-side diagnostic detail. Never rendered to the browser. */
  detail?: string;
  constructor(
    kind: LlmCallKind,
    message: string,
    extra?: { status?: number; code?: string; partial?: boolean; detail?: string }
  ) {
    super(message);
    this.name = "LlmCallError";
    this.kind = kind;
    this.status = extra?.status;
    this.code = extra?.code;
    this.partial = extra?.partial;
    this.detail = extra?.detail;
  }
}

/**
 * Gemini models tried in order. Every entry is a Google Gemini free-tier model
 * (no paid provider is ever contacted). `gemini-flash-latest` is intentionally
 * NOT used: that alias currently resolves to a model Google reports as
 * overloaded ("This model is currently experiencing high demand", HTTP 503).
 * The Flash-Lite models are the fastest and the least capacity-constrained on
 * the free tier, so they lead the chain.
 */
const DEFAULT_GEMINI_MODELS = [
  "gemini-3.5-flash-lite",
  "gemini-flash-lite-latest",
  "gemini-3.7-flash",
  "gemini-3.6-flash",
];

/** Hard cap on upstream Gemini attempts for one user request (whole chain). */
const MAX_GEMINI_ATTEMPTS = 6;
/** Exponential backoff (ms) applied before retrying the same model. */
const GEMINI_BACKOFF_MS = [800, 1600, 3200];
/** Attempts spent on one model before the chain moves on to the next model. */
const ATTEMPTS_PER_MODEL = 2;

/**
 * Ordered model chain. `GEMINI_MODEL` (when set) is tried first and the
 * default chain still follows it, so pinning a model never removes the
 * automatic failover to a healthy free-tier model.
 */
function geminiModelChain(): string[] {
  const chain: string[] = [];
  const override = process.env.GEMINI_MODEL?.trim();
  if (override) chain.push(override);
  for (const model of DEFAULT_GEMINI_MODELS) {
    if (!chain.includes(model)) chain.push(model);
  }
  return chain;
}

/** OpenAI-compatible endpoint; override for proxies/self-hosted gateways. */
const OPENAI_BASE = process.env.OPENAI_BASE_URL?.trim().replace(/\/$/, "") || "https://api.openai.com/v1";
const OPENAI_MODEL = process.env.OPENAI_MODEL?.trim() || "gpt-4o-mini";

function geminiKey(): string {
  return (process.env.GEMINI_API_KEY ?? "").trim();
}

/**
 * Removes anything that looks like a credential from text before it is logged
 * or sent to the browser. The API key never reaches this module's messages,
 * but upstream errors can echo request headers back.
 */
function redactSecrets(text: string): string {
  let out = text;
  const key = geminiKey();
  if (key.length >= 8) out = out.split(key).join("[redacted]");
  return out
    .replace(/AIza[A-Za-z0-9_-]{8,}/g, "[redacted]")
    .replace(/\bAQ\.[A-Za-z0-9._-]{16,}/g, "[redacted]");
}

function openaiKey(): string {
  return (process.env.OPENAI_API_KEY ?? "").trim();
}

export function geminiConfigured(): boolean {
  return geminiKey().length > 0;
}

export function llmConfigured(): boolean {
  return geminiConfigured() || openaiKey().length > 0;
}

function buildSystemText(contextNote?: string): string {
  return contextNote
    ? `${AI_SYSTEM_PROMPT}\n\nSearch context:\n${contextNote}`
    : AI_SYSTEM_PROMPT;
}

function buildMessages(
  history: ChatMessage[],
  contextNote?: string
): OpenAI.Chat.Completions.ChatCompletionMessageParam[] {
  return [
    { role: "system" as const, content: buildSystemText(contextNote) },
    ...history.slice(-10),
  ];
}

/** Lazily-built SDK clients — keys stay server-side, read at call time. */
let cachedGemini: GoogleGenAI | null = null;
function getGemini(): GoogleGenAI {
  if (!cachedGemini) {
    cachedGemini = new GoogleGenAI({ apiKey: geminiKey() });
  }
  return cachedGemini;
}

let cachedOpenAI: OpenAI | null = null;
function getOpenAI(): OpenAI {
  if (!cachedOpenAI) {
    cachedOpenAI = new OpenAI({
      apiKey: openaiKey(),
      baseURL: OPENAI_BASE,
      timeout: 30_000,
    });
  }
  return cachedOpenAI;
}

/** Extract the inner error JSON Gemini wraps inside its error message, if present. */
function parseGeminiError(err: unknown): {
  status?: number;
  code?: string;
  message: string;
} {
  const e = err as { status?: number | string; message?: string; code?: number | string };
  let status = typeof e?.status === "number" ? e.status : undefined;
  if (!status && typeof e?.status === "string" && /^\d+$/.test(e.status)) status = Number(e.status);
  if (!status && typeof e?.code === "number") status = e.code;
  let code = typeof e?.code === "string" ? e.code : undefined;
  let message = e?.message ?? "";
  // Gemini nests the useful payload as JSON inside .message (sometimes twice).
  for (let depth = 0; depth < 2; depth++) {
    const jsonStart = message.indexOf("{");
    if (jsonStart < 0) break;
    try {
      const inner = JSON.parse(message.slice(jsonStart)) as {
        error?: { code?: number; message?: string; status?: string };
      };
      if (!inner?.error) break;
      if (typeof inner.error.code === "number" && !status) status = inner.error.code;
      if (inner.error.status) code = inner.error.status;
      if (inner.error.message) message = inner.error.message;
    } catch {
      break; // keep last message
    }
  }
  return { status, code, message };
}

function classifyGeminiError(
  err: unknown,
  opts: { signal?: AbortSignal; model?: string }
): LlmCallError {
  const e = err as { name?: string };
  if (
    opts.signal?.aborted ||
    e?.name === "AbortError" ||
    e?.name === "APIUserAbortError" ||
    e?.name === "DOMException"
  ) {
    return new LlmCallError("aborted", "The AI request was cancelled.");
  }
  const { status, code, message } = parseGeminiError(err);
  const raw = redactSecrets(message || "");
  const original = redactSecrets(String((err as { message?: string })?.message ?? ""));
  const lower = raw.toLowerCase();
  const model = opts.model ?? "Gemini";
  const extra = {
    status,
    code,
    detail: [code, status, raw, original].filter(Boolean).join(" | ").slice(0, 2000),
  };

  if (
    code === "RESOURCE_EXHAUSTED" ||
    status === 429 ||
    lower.includes("resource_exhausted") ||
    lower.includes("quota")
  ) {
    return new LlmCallError(
      "quota",
      `The Gemini API free-tier quota is exhausted for ${model} (HTTP ${status ?? 429}). ` +
        "Limits reset per minute/day — wait for the reset and try again. No paid fallback is used.",
      extra
    );
  }
  if (
    code === "API_KEY_INVALID" ||
    code === "PERMISSION_DENIED" ||
    status === 401 ||
    status === 403 ||
    // Gemini reports a bad key as HTTP 400 INVALID_ARGUMENT with this message.
    (code === "INVALID_ARGUMENT" && /api key/i.test(raw))
  ) {
    return new LlmCallError(
      "rejected",
      `The configured GEMINI_API_KEY was rejected by the Gemini API` +
        (raw ? `: ${raw.slice(0, 160)}` : ` (HTTP ${status}).`),
      extra
    );
  }
  if (status === 404 || code === "NOT_FOUND") {
    return new LlmCallError(
      "unreachable",
      `The Gemini model "${model}" is not available for this key` +
        (raw ? `: ${raw.slice(0, 160)}` : "."),
      extra
    );
  }
  if (typeof status === "number") {
    return new LlmCallError(
      "unreachable",
      status === 503
        ? "The Gemini service is temporarily overloaded (HTTP 503). Please try again in a moment."
        : `Gemini API request failed (HTTP ${status}). Please try again in a moment.`,
      extra
    );
  }
  return new LlmCallError(
    "unreachable",
    "Could not reach the Gemini API. Please try again in a moment.",
    extra
  );
}

function classifyOpenAIError(err: unknown, opts: { signal?: AbortSignal }): LlmCallError {
  const e = err as {
    name?: string;
    status?: number;
    message?: string;
    error?: { code?: string; type?: string; message?: string };
  };
  if (
    opts.signal?.aborted ||
    e?.name === "APIUserAbortError" ||
    e?.name === "AbortError"
  ) {
    return new LlmCallError("aborted", "The AI request was cancelled.");
  }
  const status = typeof e?.status === "number" ? e.status : undefined;
  const apiCode = e?.error?.code ?? "";
  const apiMessage = e?.error?.message ?? "";
  const quotaExhausted =
    apiCode === "insufficient_quota" ||
    apiCode === "credit_balance_exhausted" ||
    apiMessage.toLowerCase().includes("no credits remaining") ||
    (e?.message ?? "").toLowerCase().includes("insufficient_quota");
  if (quotaExhausted) {
    return new LlmCallError(
      "quota",
      "The OpenAI account for this key has no remaining credits (insufficient_quota). Add credits at https://platform.openai.com/settings/organization/billing/"
    );
  }
  if (status === 401 || status === 403) {
    return new LlmCallError(
      "rejected",
      `The configured OPENAI_API_KEY was rejected by OpenAI (HTTP ${status})` +
        (apiMessage ? `: ${apiMessage.slice(0, 160)}` : ".")
    );
  }
  if (status === 429) {
    return new LlmCallError(
      "unreachable",
      "OpenAI rate limit reached (HTTP 429)" +
        (apiMessage ? `: ${apiMessage.slice(0, 160)}` : ".") +
        " Please try again in a moment."
    );
  }
  if (typeof status === "number") {
    return new LlmCallError(
      "unreachable",
      `OpenAI request failed (HTTP ${status})` + (apiMessage ? `: ${apiMessage.slice(0, 160)}` : ".")
    );
  }
  if (e?.name === "APIConnectionTimeoutError") {
    return new LlmCallError("unreachable", "The OpenAI request timed out.");
  }
  return new LlmCallError("unreachable", "Could not reach the OpenAI API.");
}

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

/** HTTP statuses that are worth another attempt against the same model. */
const RETRYABLE_STATUS = new Set([408, 425, 429, 500, 502, 503, 504]);

/**
 * True for transient upstream conditions worth another attempt. Permanent
 * failures (bad key, permission denied, invalid request) are never retried.
 */
function isRetryableGemini(err: LlmCallError): boolean {
  if (err.kind === "aborted" || err.kind === "unconfigured" || err.kind === "rejected") return false;
  if (err.kind === "stream") return true; // empty reply: another model may serve it
  if (typeof err.status === "number") return RETRYABLE_STATUS.has(err.status);
  return /overload|unavailable|temporar|try again|timed out|timeout|econnreset|etimedout|eai_again|fetch failed/i.test(
    err.message
  );
}

/**
 * True when the quota error is a per-day free-tier limit, which cannot clear
 * within this request — such a model must not be retried, but other models in
 * the chain have their own separate daily quota.
 */
function isDailyQuota(err: LlmCallError): boolean {
  const text = `${err.detail ?? ""} ${err.message}`;
  return /per[\s_-]*day|perday/i.test(text) || /\d+\s*h\s*\d*\s*m/i.test(text);
}

/** Server-side diagnostic log. Never contains the API key. */
function logGeminiFailure(model: string, attempt: number, err: LlmCallError): void {
  console.error(
    "[ai] gemini attempt failed",
    JSON.stringify({
      model,
      attempt,
      kind: err.kind,
      status: err.status,
      code: err.code,
      detail: err.detail ? redactSecrets(err.detail).slice(0, 300) : undefined,
    })
  );
}

/** One streaming attempt against Gemini. */
async function geminiAttempt(opts: {
  history: ChatMessage[];
  contextNote?: string;
  signal?: AbortSignal;
  timeoutSignal: AbortSignal;
  model: string;
  onDelta?: (chunk: string) => void;
}): Promise<string> {
  // Client disconnects abort immediately; our own timeout surfaces as a
  // clear "timed out" error instead of an empty reply.
  const signal =
    opts.signal && opts.signal !== opts.timeoutSignal
      ? AbortSignal.any([opts.signal, opts.timeoutSignal])
      : opts.timeoutSignal;

  let stream: AsyncIterable<{ text?: string }>;
  try {
    stream = await getGemini().models.generateContentStream({
      model: opts.model,
      contents: opts.history.slice(-10).map((m) => ({
        role: m.role === "assistant" ? ("model" as const) : ("user" as const),
        parts: [{ text: m.content }],
      })),
      config: {
        systemInstruction: buildSystemText(opts.contextNote),
        temperature: 0.4,
        maxOutputTokens: 800,
        abortSignal: signal,
      },
    });
  } catch (err) {
    if (opts.timeoutSignal.aborted && !opts.signal?.aborted) {
      throw new LlmCallError(
        "unreachable",
        "The Gemini request timed out. Please try again.",
        { detail: `timeout model=${opts.model}` }
      );
    }
    throw classifyGeminiError(err, { signal: opts.signal, model: opts.model });
  }

  let full = "";
  try {
    for await (const chunk of stream) {
      const delta = chunk.text;
      if (delta) {
        full += delta;
        opts.onDelta?.(delta);
      }
    }
  } catch (err) {
    if (opts.signal?.aborted) {
      if (full) return full; // client stopped mid-stream: keep what we have
      throw new LlmCallError("aborted", "The AI request was cancelled.");
    }
    if (opts.timeoutSignal.aborted) {
      if (full) return full;
      throw new LlmCallError(
        "unreachable",
        "The Gemini request timed out. Please try again.",
        { detail: `timeout model=${opts.model}` }
      );
    }
    const classified = classifyGeminiError(err, { signal: opts.signal, model: opts.model });
    // Text was already streamed: do not let another model answer on top of it.
    classified.partial = full.length > 0;
    throw classified;
  }
  if (!full.trim()) {
    throw new LlmCallError("stream", "The Gemini model returned an empty response.", {
      detail: `empty response model=${opts.model}`,
    });
  }
  return full;
}

/**
 * Streams a reply via the Gemini free tier (primary provider).
 *
 * The free tier is shared, so individual models intermittently answer HTTP 503
 * ("high demand") or HTTP 429 (rate/quota). This walks an ordered chain of
 * free-tier models: a transient failure is retried once on the same model with
 * exponential backoff, then the chain moves to the next model (each model has
 * its own free-tier quota). Attempts are hard-capped so the user is never
 * delayed indefinitely, and a model switch only happens before any text has
 * been streamed, so the chat never shows duplicated answers.
 */
async function streamGeminiReply(opts: {
  history: ChatMessage[];
  contextNote?: string;
  signal?: AbortSignal;
  onDelta?: (chunk: string) => void;
}): Promise<string> {
  const timeoutSignal = AbortSignal.timeout(90_000);
  const chain = geminiModelChain();
  let attempts = 0;
  let lastErr: LlmCallError | undefined;

  for (const model of chain) {
    let modelAttempts = 0;
    while (attempts < MAX_GEMINI_ATTEMPTS) {
      attempts++;
      modelAttempts++;
      try {
        return await geminiAttempt({ ...opts, timeoutSignal, model });
      } catch (err) {
        const llmErr =
          err instanceof LlmCallError
            ? err
            : classifyGeminiError(err, { signal: opts.signal, model });
        lastErr = llmErr;
        logGeminiFailure(model, attempts, llmErr);

        // Already streamed text: never retry, never switch models.
        if (llmErr.partial) throw llmErr;
        // A retired model (HTTP 404): move straight to the next one.
        if (llmErr.status === 404) break;
        // Permanent failures (invalid key, permission, bad request): stop now.
        if (!isRetryableGemini(llmErr)) throw llmErr;
        // Daily quota for this model is gone; another model has its own quota.
        if (llmErr.kind === "quota" && isDailyQuota(llmErr)) break;
        if (llmErr.kind === "stream") break; // empty reply: try another model
        if (modelAttempts >= ATTEMPTS_PER_MODEL || attempts >= MAX_GEMINI_ATTEMPTS) break;

        await sleep(GEMINI_BACKOFF_MS[Math.min(modelAttempts - 1, GEMINI_BACKOFF_MS.length - 1)]);
        if (opts.signal?.aborted) throw llmErr;
      }
    }
    if (attempts >= MAX_GEMINI_ATTEMPTS) break;
  }

  throw (
    lastErr ??
    new LlmCallError("unreachable", "Could not reach the Gemini API. Please try again in a moment.")
  );
}

/** Streams a reply via OpenAI (fallback provider, kept for compatibility). */
async function streamOpenAIReply(opts: {
  history: ChatMessage[];
  contextNote?: string;
  signal?: AbortSignal;
  onDelta?: (chunk: string) => void;
}): Promise<string> {
  // Cap total request time at 30s while still honouring client disconnects.
  const signal = opts.signal
    ? AbortSignal.any([opts.signal, AbortSignal.timeout(30_000)])
    : AbortSignal.timeout(30_000);

  let stream: AsyncIterable<OpenAI.Chat.Completions.ChatCompletionChunk>;
  try {
    stream = await getOpenAI().chat.completions.create(
      {
        model: OPENAI_MODEL,
        temperature: 0.4,
        max_tokens: 500,
        stream: true,
        messages: buildMessages(opts.history, opts.contextNote),
      },
      { signal }
    );
  } catch (err) {
    throw classifyOpenAIError(err, opts);
  }

  let full = "";
  try {
    for await (const chunk of stream) {
      const delta = chunk.choices?.[0]?.delta?.content;
      if (delta) {
        full += delta;
        opts.onDelta?.(delta);
      }
    }
  } catch (err) {
    if (
      opts.signal?.aborted ||
      (err as { name?: string })?.name === "APIUserAbortError" ||
      (err as { name?: string })?.name === "AbortError"
    ) {
      if (full) return full; // client stopped mid-stream: keep what we have
      throw new LlmCallError("aborted", "The AI request was cancelled.");
    }
    throw new LlmCallError("stream", "The AI response stream was interrupted.");
  }
  if (!full.trim()) {
    throw new LlmCallError("stream", "The AI model returned an empty response.");
  }
  return full;
}

/**
 * Streams a model reply. Each decoded text chunk is pushed to `onDelta`.
 * Resolves with the full accumulated text, or throws `LlmCallError`.
 * Tries Gemini (free tier) first; falls back to OpenAI only when no Gemini
 * key is configured. Gemini quota/limit errors are surfaced as `quota` and
 * never silently switch providers.
 */
export async function streamAiReply(opts: {
  history: ChatMessage[];
  contextNote?: string;
  signal?: AbortSignal;
  onDelta?: (chunk: string) => void;
}): Promise<string> {
  if (geminiConfigured()) {
    return streamGeminiReply(opts);
  }
  if (openaiKey()) {
    return streamOpenAIReply(opts);
  }
  throw new LlmCallError(
    "unconfigured",
    "Neither GEMINI_API_KEY nor OPENAI_API_KEY is set on the server."
  );
}
