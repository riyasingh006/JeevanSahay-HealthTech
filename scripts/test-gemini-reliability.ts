import assert from "node:assert/strict";
import { LlmCallError, streamAiReply } from "../src/lib/llm";
import {
  assistantHistoryPayload,
  assistantMessageText,
  assistantSseData,
  ensureAssistantStreamCompleted,
  isAssistantAbortError,
  settleAssistantRequestError,
  splitAssistantSseEvents,
} from "../src/lib/ai-assistant-state";

const apiKey = "test-gemini-api-key-not-valid";
const sensitiveUserText = "PRIVATE_PATIENT_DATA_SENTINEL";
const originalFetch = globalThis.fetch;
const originalError = console.error;
const originalGeminiKey = process.env.GEMINI_API_KEY;
const originalModel = process.env.GEMINI_MODEL;
const originalOpenAiKey = process.env.OPENAI_API_KEY;
const logs: string[] = [];

process.env.GEMINI_API_KEY = apiKey;
process.env.GEMINI_MODEL = "";
delete process.env.OPENAI_API_KEY;
console.error = (...args: unknown[]) => logs.push(args.map(String).join(" "));

interface CapturedRequest {
  model: string;
  body: Record<string, unknown>;
}

function sse(candidate: Record<string, unknown>): string {
  return `data: ${JSON.stringify({ candidates: [candidate] })}\n\n`;
}

function textCandidate(text: string, finishReason?: string, continuationToken?: string) {
  return {
    content: { role: "model", parts: [{ text }] },
    ...(finishReason ? { finishReason } : {}),
    ...(continuationToken ? { continuationToken } : {}),
  };
}

async function runScenario(
  respond: (request: CapturedRequest, index: number, signal?: AbortSignal) => Response | Promise<Response>
): Promise<CapturedRequest[]> {
  const requests: CapturedRequest[] = [];
  globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = new URL(String(input));
    const match = url.pathname.match(/\/models\/([^:]+):streamGenerateContent$/);
    assert.ok(match, "Gemini request uses the expected streaming endpoint");
    const body = JSON.parse(String(init?.body)) as Record<string, unknown>;
    const request = { model: decodeURIComponent(match[1]), body };
    requests.push(request);
    return respond(request, requests.length - 1, init?.signal ?? undefined);
  }) as typeof fetch;
  return requests;
}

async function ask(onDelta?: (text: string) => void, signal?: AbortSignal): Promise<string> {
  return streamAiReply({
    history: [{ role: "user", content: sensitiveUserText }],
    onDelta,
    signal,
  });
}

async function main() {
  try {
    const question = { role: "user" as const, content: "My health question." };
    const emptyAssistant = { role: "assistant" as const, content: "" };
    const stoppedBeforeText = settleAssistantRequestError([question, emptyAssistant], 1, {
      aborted: true,
      streamExpected: true,
      streamCompleted: false,
    });
    assert.equal(stoppedBeforeText[1].content, "");
    assert.match(assistantMessageText(stoppedBeforeText[1]), /incomplete/i);
    assert.deepEqual(assistantHistoryPayload(stoppedBeforeText), [question]);
    console.log("PASS stop before first text marks interruption and excludes it from history");

    const partialAssistant = { role: "assistant" as const, content: "Partial medical guidance." };
    const stoppedAfterText = settleAssistantRequestError([question, partialAssistant], 1, {
      aborted: true,
      streamExpected: true,
      streamCompleted: false,
    });
    assert.equal(stoppedAfterText[1].content, "");
    assert.equal("interrupted" in stoppedAfterText[1] && stoppedAfterText[1].interrupted, true);
    assert.deepEqual(assistantHistoryPayload(stoppedAfterText), [question]);
    console.log("PASS stop after partial text clears the draft and excludes it from history");

    const abortError = new Error("The stream was aborted.");
    abortError.name = "AbortError";
    const abortAfterText = settleAssistantRequestError([question, partialAssistant], 1, {
      aborted: isAssistantAbortError(abortError),
      streamExpected: true,
      streamCompleted: false,
    });
    assert.equal("interrupted" in abortAfterText[1] && abortAfterText[1].interrupted, true);
    assert.deepEqual(assistantHistoryPayload([...abortAfterText, { role: "user" as const, content: "Follow-up." }]), [
      question,
      { role: "user", content: "Follow-up." },
    ]);
    console.log("PASS AbortError after partial output is visibly incomplete and omitted from later requests");

    assert.throws(() => ensureAssistantStreamCompleted(false, false), /interrupted/i);
    const incompleteStream = settleAssistantRequestError([question, partialAssistant], 1, {
      aborted: false,
      streamExpected: true,
      streamCompleted: false,
    });
    assert.deepEqual(incompleteStream, [question]);
    console.log("PASS stream ending without a completion event discards partial output");

    const completedBeforeAbort = settleAssistantRequestError([question, partialAssistant], 1, {
      aborted: true,
      streamExpected: true,
      streamCompleted: true,
    });
    assert.equal(completedBeforeAbort[1].content, partialAssistant.content);
    console.log("PASS late abort does not erase a response already marked complete");

    const sseChunks = [
      'data: {"type":"meta","sessionId":"test-session"}\r\n\r',
      '\ndata: {"type":"done",\r\n',
      'data: "reply":"complete"}\r\n\r\n',
    ];
    let sseBuffer = "";
    const parsedSseEvents: string[] = [];
    for (const chunk of sseChunks) {
      sseBuffer += chunk;
      const parsed = splitAssistantSseEvents(sseBuffer);
      parsedSseEvents.push(...parsed.events);
      sseBuffer = parsed.remainder;
    }
    const parsedSseFinal = splitAssistantSseEvents(sseBuffer, true);
    parsedSseEvents.push(...parsedSseFinal.events);
    assert.deepEqual(parsedSseEvents.map((event) => JSON.parse(assistantSseData(event)!)), [
      { type: "meta", sessionId: "test-session" },
      { type: "done", reply: "complete" },
    ]);
    assert.deepEqual(splitAssistantSseEvents('data: {"type":"done"}', true).events, [
      'data: {"type":"done"}',
    ]);
    console.log("PASS LF/CRLF SSE frames, fragmented delimiters, multi-line data and final-frame flush");

    const retryRequests = await runScenario((_request, index) => {
      if (index === 0) {
        return new Response(
          JSON.stringify({
            error: {
              code: 503,
              status: "UNAVAILABLE",
              message: `Temporary high demand; ${sensitiveUserText}`,
            },
          }),
          { status: 503, headers: { "content-type": "application/json" } }
        );
      }
      if (index === 1) {
        return new Response(
          JSON.stringify({
            error: {
              code: 429,
              status: "RESOURCE_EXHAUSTED",
              message: `Temporary rate limit; ${sensitiveUserText}`,
            },
          }),
          { status: 429, headers: { "content-type": "application/json" } }
        );
      }
      return new Response(sse(textCandidate("Available fallback response.", "STOP")), {
        headers: { "content-type": "text/event-stream" },
      });
    });
    const retriedReply = await ask();
    assert.equal(retriedReply, "Available fallback response.");
    assert.deepEqual(retryRequests.map((request) => request.model), [
      "gemini-3.5-flash-lite",
      "gemini-3.5-flash-lite",
      "gemini-3.6-flash",
    ]);
    assert.ok(retryRequests.every((request) => request.body.store === false));
    assert.ok(
      retryRequests.every((request) => !/\"(?:temperature|topP|topK)\"\s*:/.test(JSON.stringify(request.body)))
    );
    assert.ok(logs.every((entry) => !entry.includes(apiKey) && !entry.includes(sensitiveUserText)));
    console.log("PASS bounded 503/429 retries, model failover, and privacy-safe logs");

    const fallbackRequests = await runScenario((request) => {
      if (request.model !== "gemini-3.1-flash-lite") {
        return new Response(JSON.stringify({ error: { code: 404, status: "NOT_FOUND" } }), {
          status: 404,
          headers: { "content-type": "application/json" },
        });
      }
      return new Response(sse(textCandidate("Verified stable fallback.", "STOP")), {
        headers: { "content-type": "text/event-stream" },
      });
    });
    const fallbackReply = await ask();
    assert.equal(fallbackReply, "Verified stable fallback.");
    assert.deepEqual(fallbackRequests.map((request) => request.model), [
      "gemini-3.5-flash-lite",
      "gemini-3.6-flash",
      "gemini-3.1-flash-lite",
    ]);
    console.log("PASS supported model fallback order after model-unavailable response");

    const safetyDeltas: string[] = [];
    const safetyRequests = await runScenario(() =>
      new Response(sse(textCandidate("Filtered partial content.", "SAFETY")), {
        headers: { "content-type": "text/event-stream" },
      })
    );
    await assert.rejects(ask((text) => safetyDeltas.push(text)), /did not complete/i);
    assert.equal(safetyRequests.length, 1);
    assert.deepEqual(safetyDeltas, ["Filtered partial content."]);

    const blockedRequests = await runScenario(() =>
      new Response(sse(textCandidate("", "SAFETY")), {
        headers: { "content-type": "text/event-stream" },
      })
    );
    await assert.rejects(ask(), /did not complete/i);
    assert.equal(blockedRequests.length, 1);
    console.log("PASS safety-filtered output is never accepted as complete or retried through another model");

    const incompleteRequests = await runScenario((_request, index) =>
      index === 0
        ? new Response('data: {"candidates":[', {
            headers: { "content-type": "text/event-stream" },
          })
        : new Response(sse(textCandidate("Recovered response.", "STOP")), {
            headers: { "content-type": "text/event-stream" },
          })
    );
    assert.equal(await ask(), "Recovered response.");
    assert.equal(incompleteRequests.length, 2);
    console.log("PASS incomplete SSE JSON is retried safely when no text was emitted");

    const partialDeltas: string[] = [];
    const partialRequests = await runScenario(() =>
      new Response(`${sse(textCandidate("Partial text."))}data: {"candidates":[`, {
        headers: { "content-type": "text/event-stream" },
      })
    );
    await assert.rejects(ask((text) => partialDeltas.push(text)), /Could not reach the Gemini API/);
    assert.equal(partialRequests.length, 1);
    assert.deepEqual(partialDeltas, ["Partial text."]);
    console.log("PASS partial stream failures are not retried or duplicated");

    const abortController = new AbortController();
    const abortRequests = await runScenario((_request, _index, signal) => {
      const body = new ReadableStream<Uint8Array>({
        start(controller) {
          controller.enqueue(new TextEncoder().encode(sse(textCandidate("Partial output."))));
          const abort = () => controller.error(new DOMException("The stream was aborted.", "AbortError"));
          signal?.addEventListener("abort", abort, { once: true });
          if (signal?.aborted) abort();
        },
      });
      return new Response(body, { headers: { "content-type": "text/event-stream" } });
    });
    const abortDeltas: string[] = [];
    await assert.rejects(
      ask((text) => {
        abortDeltas.push(text);
        abortController.abort();
      }, abortController.signal),
      (error: unknown) =>
        error instanceof LlmCallError && error.kind === "aborted" && error.partial === true
    );
    assert.equal(abortRequests.length, 1);
    assert.deepEqual(abortDeltas, ["Partial output."]);
    console.log("PASS client cancellation after Gemini text rejects as partial, not a completed reply");

    let continuationIndex = 0;
    const continuationRequests = await runScenario((request) => {
      continuationIndex++;
      if (continuationIndex === 1) {
        return new Response(sse(textCandidate("First part. ", undefined, "checkpoint-1")), {
          headers: { "content-type": "text/event-stream" },
        });
      }
      return new Response(sse(textCandidate("Second part.", "STOP")), {
        headers: { "content-type": "text/event-stream" },
      });
    });
    assert.equal(await ask(), "First part. Second part.");
    assert.equal(continuationRequests.length, 2);
    assert.equal(continuationRequests[1].body.continuationToken, "checkpoint-1");
    assert.equal(continuationRequests[0].body.continuationToken, undefined);
    assert.ok(continuationRequests.every((request) => request.body.store === false));
    console.log("PASS explicit continuation resumes from checkpoint within request budget");

    let budgetIndex = 0;
    const budgetRequests = await runScenario(() => {
      budgetIndex++;
      return new Response(sse(textCandidate(`part-${budgetIndex}`, undefined, `checkpoint-${budgetIndex}`)), {
        headers: { "content-type": "text/event-stream" },
      });
    });
    await assert.rejects(ask(), /request limit was reached/);
    assert.equal(budgetRequests.length, 6);
    console.log("PASS total upstream stream requests are capped at six");
  } finally {
    globalThis.fetch = originalFetch;
    console.error = originalError;
    if (originalGeminiKey === undefined) delete process.env.GEMINI_API_KEY;
    else process.env.GEMINI_API_KEY = originalGeminiKey;
    if (originalModel === undefined) delete process.env.GEMINI_MODEL;
    else process.env.GEMINI_MODEL = originalModel;
    if (originalOpenAiKey === undefined) delete process.env.OPENAI_API_KEY;
    else process.env.OPENAI_API_KEY = originalOpenAiKey;
  }
}

main().catch((error: unknown) => {
  console.error("Gemini reliability tests failed:", error instanceof Error ? error.message : "unknown error");
  process.exitCode = 1;
});
