"use client";

import * as React from "react";
import { motion } from "framer-motion";
import {
  BrainCircuit,
  Hospital,
  MapPin,
  Mic,
  MicOff,
  PhoneCall,
  RotateCcw,
  SendHorizonal,
  Siren,
  Square,
  Star,
  UserRound,
  Volume2,
  VolumeX,
} from "lucide-react";
import { Button, buttonVariants } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { DemoDataBadge, DemoFacilityNotice, FacilityReportedNotice } from "@/components/ui/data-source";
import { useToast } from "@/components/ui/toast";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import {
  getCurrentPosition,
  loadPatientLocation,
  savePatientLocation,
  type GeoErrorKind,
} from "@/lib/patient/location";
import {
  assistantHistoryPayload,
  assistantMessageText,
  assistantSseData,
  ensureAssistantStreamCompleted,
  isAssistantAbortError,
  settleAssistantRequestError,
  splitAssistantSseEvents,
  type AssistantConversationMessage,
} from "@/lib/ai-assistant-state";

interface Rec {
  id: string;
  isDemo?: boolean;
  name: string;
  score: number;
  distanceKm: number;
  etaMinutes: number;
  icuAvailable?: number;
  emergencyActive?: boolean;
  address?: string;
  rating?: number;
  reviewCount?: number;
  googleMapsUri?: string;
  phone?: string;
  openingStatus?: string;
  dataSource?: string;
  lat?: number;
  lng?: number;
}

interface Msg extends AssistantConversationMessage {
  recommendations?: Rec[];
  urgency?: string;
  timestamp?: string;
}

interface LocState {
  lat: number;
  lng: number;
  label: string;
}

type AiStatus = "ready" | "unconfigured" | "rejected" | "quota" | null;

const STARTERS = [
  "Find a cardiologist near me",
  "I have fever and headache",
  "Find nearby emergency care",
  "Find hospitals with ICU facilities",
];

const GREETING =
  "Namaste! I'm Jeevan AI. Tell me about your symptoms or the healthcare service you need, and I'll help you explore suitable nearby healthcare options.";

function formatTime(iso?: string): string {
  if (!iso) return "";
  try {
    return new Date(iso).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  } catch {
    return "";
  }
}

function hospitalDetailsHref(r: Rec, embedded: boolean): string {
  if (r.id?.startsWith("gplaces_")) {
    const placeId = r.id.slice("gplaces_".length);
    if (placeId) {
      return `https://www.google.com/maps/place/?q=place_id:${encodeURIComponent(placeId)}`;
    }
  }
  const base = embedded ? "/dashboard/hospitals" : "/hospitals";
  return `${base}/${encodeURIComponent(r.id)}`;
}

function directionsHref(r: Rec): string {
  if (typeof r.lat === "number" && typeof r.lng === "number") {
    return `https://www.google.com/maps/dir/?api=1&destination=${r.lat},${r.lng}`;
  }
  if (r.googleMapsUri) return r.googleMapsUri;
  if (r.address) {
    return `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(r.address)}`;
  }
  return "https://www.google.com/maps";
}

function speechLang(text: string): string {
  if (/[\u0900-\u097F]/.test(text)) return "hi-IN";
  const nav = typeof navigator !== "undefined" ? navigator.language ?? "" : "";
  return nav.toLowerCase().startsWith("hi") ? "hi-IN" : "en-IN";
}

export function AiAssistantClient({ embedded = false }: { embedded?: boolean } = {}) {
  const [messages, setMessages] = React.useState<Msg[]>([
    { role: "assistant", content: GREETING, timestamp: new Date().toISOString() },
  ]);
  const [input, setInput] = React.useState("");
  const [pending, setPending] = React.useState(false);
  const [sessionId, setSessionId] = React.useState<string | undefined>();
  const [aiStatus, setAiStatus] = React.useState<AiStatus>(null);
  const [lastError, setLastError] = React.useState<string | null>(null);
  const [lastSent, setLastSent] = React.useState<string | null>(null);
  const [speakingIdx, setSpeakingIdx] = React.useState<number | null>(null);

  const [location, setLocation] = React.useState<LocState | null>(null);
  const [locBusy, setLocBusy] = React.useState(false);
  const [locQuery, setLocQuery] = React.useState("");

  const [micSupported, setMicSupported] = React.useState(true);
  const [ttsSupported, setTtsSupported] = React.useState(true);
  const [listening, setListening] = React.useState(false);

  const listRef = React.useRef<HTMLDivElement>(null);
  const abortRef = React.useRef<AbortController | null>(null);
  const recRef = React.useRef<any>(null);
  const { toast } = useToast();
  const toastRef = React.useRef(toast);
  React.useEffect(() => {
    toastRef.current = toast;
  });

  React.useEffect(() => {
    const saved = loadPatientLocation();
    if (saved) setLocation({ lat: saved.lat, lng: saved.lng, label: saved.label });
  }, []);

  React.useEffect(() => {
    setTtsSupported(typeof window !== "undefined" && "speechSynthesis" in window);
    const SR =
      typeof window !== "undefined"
        ? (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition
        : undefined;
    if (!SR) setMicSupported(false);
    return () => {
      try {
        window.speechSynthesis?.cancel();
      } catch {
        /* not supported */
      }
    };
  }, []);

  React.useEffect(() => {
    const SR =
      typeof window !== "undefined"
        ? (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition
        : undefined;
    if (!SR) return;
    try {
      const rec = new SR();
      rec.interimResults = true;
      rec.continuous = false;
      rec.maxAlternatives = 1;
      rec.onresult = (e: any) => {
        let transcript = "";
        for (let i = 0; i < e.results.length; i++) {
          transcript += e.results[i][0]?.transcript ?? "";
        }
        setInput(transcript);
      };
      rec.onerror = (e: any) => {
        setListening(false);
        const code = e?.error as string | undefined;
        if (code === "not-allowed" || code === "service-not-allowed") {
          toastRef.current({
            title: "Microphone access denied",
            description: "Allow microphone permission in your browser to speak to Jeevan AI.",
            variant: "error" as any,
          });
        } else if (code === "no-speech") {
          toastRef.current({
            title: "No speech detected",
            description: "Please try again and speak clearly.",
            variant: "error" as any,
          });
        } else if (code === "network") {
          toastRef.current({
            title: "Voice input unavailable",
            description: "Speech recognition needs an internet connection.",
            variant: "error" as any,
          });
        } else if (code && code !== "aborted") {
          toastRef.current({
            title: "Voice input stopped",
            description: "You can still type your message below.",
            variant: "error" as any,
          });
        }
      };
      rec.onend = () => setListening(false);
      recRef.current = rec;
    } catch {
      setMicSupported(false);
    }
    return () => {
      try {
        recRef.current?.abort();
      } catch {
        /* already stopped */
      }
      recRef.current = null;
    };
  }, []);

  React.useEffect(() => {
    listRef.current?.scrollTo({ top: listRef.current.scrollHeight, behavior: "smooth" });
  }, [messages, pending]);

  const locateMe = async () => {
    try {
      setLocBusy(true);
      const pos = await getCurrentPosition();
      const loc: LocState = { lat: pos.lat, lng: pos.lng, label: "My Current Location" };
      setLocation(loc);
      savePatientLocation({ ...loc, source: "device", savedAt: new Date().toISOString() } as any);
    } catch (e) {
      const kind = (e as { kind?: GeoErrorKind })?.kind;
      if (kind === "denied")
        toast({
          title: "Location access denied",
          description: "Enable location permission or enter a city, area, PIN code, or address below.",
          variant: "error" as any,
        });
      else if (kind === "unavailable")
        toast({
          title: "Location unavailable",
          description: "Please enter a city, area, PIN code, or address below.",
          variant: "error" as any,
        });
      else
        toast({
          title: "Location error",
          description: "Please enter a city, area, PIN code, or address below.",
          variant: "error" as any,
        });
    } finally {
      setLocBusy(false);
    }
  };

  const setManual = async (query: string) => {
    const q = query.trim();
    if (!q) return;
    try {
      setLocBusy(true);
      const res = await fetch(`/api/patient/geocode?q=${encodeURIComponent(q)}`);
      const json = await res.json();
      if (!json.ok || typeof json.data?.lat !== "number" && typeof json.data?.results?.[0]?.lat !== "number") {
        throw new Error(json.error ?? "Geocoding failed");
      }
      const hit = json.data.results?.[0] ?? json.data;
      const loc: LocState = { lat: hit.lat, lng: hit.lng, label: hit.label ?? q };
      setLocation(loc);
      savePatientLocation({ ...loc, source: "address", savedAt: new Date().toISOString() } as any);
      setLocQuery("");
    } catch {
      toast({
        title: "Could not resolve that location",
        description: "Try a different city, locality, PIN code, or address.",
        variant: "error" as any,
      });
    } finally {
      setLocBusy(false);
    }
  };

  const patchMsg = (idx: number, update: Partial<Msg> | ((prev: Msg) => Partial<Msg>)) => {
    setMessages((m) =>
      m.map((msg, i) => (i !== idx ? msg : { ...msg, ...(typeof update === "function" ? update(msg) : update) }))
    );
  };

  const stopResponse = () => {
    abortRef.current?.abort();
  };

  const send = async (text: string) => {
    const message = text.trim();
    if (!message || pending) return;
    setInput("");
    setLastError(null);
    setLastSent(message);

    const historyPayload = assistantHistoryPayload(messages);
    const assistantIdx = messages.length + 1;

    setMessages((m) => [
      ...m,
      { role: "user", content: message, timestamp: new Date().toISOString() },
      { role: "assistant", content: "", timestamp: new Date().toISOString() },
    ]);
    setPending(true);

    const controller = new AbortController();
    abortRef.current = controller;

    let streamExpected = false;
    let streamCompleted = false;

    try {
      const res = await fetch("/api/ai/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        signal: controller.signal,
        body: JSON.stringify({
          message,
          sessionId,
          lat: location?.lat,
          lng: location?.lng,
          locationLabel: location?.label,
          history: historyPayload,
        }),
      });

      if (!res.ok) {
        const j = await res.json().catch(() => null);
        throw new Error(j?.error ?? `Request failed (${res.status})`);
      }

      const contentType = res.headers.get("content-type") ?? "";
      streamExpected = contentType.includes("text/event-stream");
      if (!streamExpected) {
        const json = await res.json();
        if (!json.ok) throw new Error(json.error ?? "AI unavailable");
        if (json.data?.sessionId) setSessionId(json.data.sessionId);
        if (json.data?.aiStatus) setAiStatus(json.data.aiStatus);
        patchMsg(assistantIdx, {
          content: json.data.reply,
          urgency: json.data.urgency,
          recommendations: json.data.recommendations?.length ? json.data.recommendations : undefined,
        });
        return;
      }

      const reader = res.body?.getReader();
      if (!reader) throw new Error("Streaming not supported by this browser.");
      const decoder = new TextDecoder();
      let buffer = "";
      const applyEvent = (event: string) => {
        if (controller.signal.aborted || streamCompleted) return;
        const data = assistantSseData(event);
        if (!data) return;
        let payload: any;
        try {
          payload = JSON.parse(data);
        } catch {
          return;
        }
        if (payload?.type === "meta") {
          if (payload.sessionId) setSessionId(payload.sessionId);
          if (payload.aiStatus) setAiStatus(payload.aiStatus);
          patchMsg(assistantIdx, {
            urgency: payload.urgency,
            recommendations: payload.recommendations?.length
              ? payload.recommendations
              : undefined,
          });
        } else if (payload?.type === "delta" && typeof payload.text === "string") {
          patchMsg(assistantIdx, (prev) => ({ content: prev.content + payload.text }));
        } else if (payload?.type === "replace" && typeof payload.text === "string") {
          patchMsg(assistantIdx, { content: payload.text });
        } else if (payload?.type === "done") {
          streamCompleted = true;
          if (payload.aiStatus) setAiStatus(payload.aiStatus);
          if (typeof payload.reply === "string" && payload.reply.length > 0) {
            patchMsg(assistantIdx, { content: payload.reply });
          }
        } else if (payload?.type === "error") {
          throw new Error(payload.message ?? "AI unavailable");
        }
      };

      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const parsed = splitAssistantSseEvents(buffer);
        buffer = parsed.remainder;
        for (const event of parsed.events) applyEvent(event);
      }
      buffer += decoder.decode();
      const finalEvents = splitAssistantSseEvents(buffer, true);
      buffer = finalEvents.remainder;
      for (const event of finalEvents.events) applyEvent(event);
      ensureAssistantStreamCompleted(streamCompleted, controller.signal.aborted);

      setMessages((m) =>
        m.map((msg, i) =>
          i === assistantIdx && !msg.content.trim() ? { ...msg, content: "(No response received.)" } : msg
        )
      );
    } catch (e) {
      const aborted = isAssistantAbortError(e);
      setMessages((m) =>
        settleAssistantRequestError(m, assistantIdx, {
          aborted,
          streamExpected,
          streamCompleted,
        })
      );
      if (!aborted) {
        const msg = e instanceof Error ? e.message : "Please try again shortly.";
        setLastError(msg);
        toast({ title: "Jeevan AI is unavailable", description: msg, variant: "error" as any });
      }
    } finally {
      setPending(false);
      abortRef.current = null;
    }
  };

  const retry = () => {
    if (lastSent) send(lastSent);
  };

  const startNewConversation = () => {
    abortRef.current?.abort();
    try {
      window.speechSynthesis?.cancel();
    } catch {
      /* not supported */
    }
    setSpeakingIdx(null);
    setMessages([{ role: "assistant", content: GREETING, timestamp: new Date().toISOString() }]);
    setSessionId(undefined);
    setLastError(null);
    setLastSent(null);
  };

  const toggleMic = () => {
    const rec = recRef.current;
    if (!rec) {
      toast({
        title: "Voice input not supported",
        description: "This browser does not support speech recognition. Please type instead.",
        variant: "error" as any,
      });
      return;
    }
    if (listening) {
      try {
        rec.stop();
      } catch {
        /* already stopped */
      }
      setListening(false);
      return;
    }
    try {
      rec.lang = speechLang(input);
      rec.start();
      setListening(true);
    } catch {
      // Recognition already started — ignore.
    }
  };

  const speak = (msg: Msg, idx: number) => {
    if (!ttsSupported || typeof window === "undefined") return;
    if (speakingIdx === idx) {
      window.speechSynthesis.cancel();
      setSpeakingIdx(null);
      return;
    }
    window.speechSynthesis.cancel();
    const utter = new SpeechSynthesisUtterance(msg.content);
    utter.lang = speechLang(msg.content);
    utter.onend = () => setSpeakingIdx(null);
    utter.onerror = () => setSpeakingIdx(null);
    setSpeakingIdx(idx);
    window.speechSynthesis.speak(utter);
  };

  const allRecs = React.useMemo(() => {
    const last = [...messages].reverse().find((m) => m.recommendations?.length);
    return last?.recommendations ?? [];
  }, [messages]);

  const dataSourceLabel = allRecs.length > 0 ? allRecs[0]?.dataSource : undefined;
  const lastMsg = messages[messages.length - 1];
  const waitingForFirstToken = pending && lastMsg?.role === "assistant" && !lastMsg.content;

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
        <div>
          <div className="flex items-center gap-2">
            <div className="h-9 w-9 rounded-lg bg-slate-900 flex items-center justify-center">
              <BrainCircuit className="h-5 w-5 text-white" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-slate-900">Jeevan AI</h1>
              <p className="text-sm text-slate-500">Your intelligent healthcare navigation assistant</p>
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {aiStatus === "unconfigured" && (
            <Badge
              className="w-fit bg-amber-50 text-amber-700 border-amber-200"
              title="GEMINI_API_KEY is not configured on the server — natural-language chat is disabled until it is added."
            >
              AI chat not configured
            </Badge>
          )}
          {aiStatus === "rejected" && (
            <Badge
              className="w-fit bg-red-50 text-red-700 border-red-200"
              title="The configured GEMINI_API_KEY was rejected by the Gemini API."
            >
              AI key rejected
            </Badge>
          )}
          {aiStatus === "quota" && (
            <Badge
              className="w-fit bg-amber-50 text-amber-700 border-amber-200"
              title="The Gemini API quota or rate limit has been reached. Check the configured project's quota and billing, or try again later. Hospital search still works."
            >
              AI quota exhausted
            </Badge>
          )}
          <Badge className="w-fit bg-teal-50 text-teal-700 border-teal-200">
            Your privacy and health matter.
          </Badge>
        </div>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-3 flex w-full min-w-0 flex-col gap-2 sm:flex-row sm:items-center">
        <div className="flex items-center gap-2 text-sm text-slate-600 flex-1 min-w-0">
          <MapPin className="h-4 w-4 shrink-0 text-teal-600" />
          <span className="truncate">
            {location ? (
              <>
                Searching near <span className="font-medium text-slate-900">{location.label}</span>
              </>
            ) : (
              "No location selected"
            )}
          </span>
        </div>
        <div className="flex w-full min-w-0 flex-wrap items-center gap-2 sm:w-auto sm:flex-nowrap">
          <Button size="sm" variant="subtle" onClick={locateMe} disabled={locBusy}>
            <MapPin className="h-4 w-4 mr-1" />
            {locBusy ? "Detecting..." : "Use My Current Location"}
          </Button>
          <Input
            value={locQuery}
            onChange={(e) => setLocQuery(e.target.value)}
            placeholder="City, area, PIN code, or address"
            className="h-9 w-44 max-w-full min-w-0"
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                setManual(locQuery);
              }
            }}
          />
          <Button size="sm" onClick={() => setManual(locQuery)} disabled={locBusy || !locQuery.trim()}>
            Update Location
          </Button>
        </div>
      </div>

      <div className="flex flex-col lg:flex-row gap-4 items-start">
        <div className="flex-1 min-w-0 w-full lg:w-[62%] bg-white rounded-xl shadow-sm border border-slate-200 flex flex-col h-[600px]">
          <div className="flex items-center justify-between px-4 py-3 border-b border-slate-100">
            <div className="flex items-center gap-2">
              <div className="h-8 w-8 rounded-full bg-blue-50 flex items-center justify-center">
                <BrainCircuit className="h-4 w-4 text-blue-600" />
              </div>
              <div>
                <div className="text-sm font-semibold text-slate-900">Jeevan AI</div>
                <div className="text-xs text-slate-500">Healthcare assistant</div>
              </div>
            </div>
            <Button size="sm" variant="ghost" onClick={startNewConversation}>
              <RotateCcw className="h-4 w-4 mr-1" />
              New conversation
            </Button>
          </div>

          <div ref={listRef} className="flex-1 overflow-y-auto px-4 py-4 space-y-3">
            {messages.map((m, i) => (
              <motion.div
                key={i}
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.18 }}
                className={`flex ${m.role === "user" ? "justify-end" : "justify-start"}`}
              >
                <div className="flex items-end gap-2 max-w-[85%]">
                  {m.role === "assistant" && (
                    <div className="h-7 w-7 rounded-full bg-slate-100 flex items-center justify-center shrink-0">
                      <UserRound className="h-3.5 w-3.5 text-slate-600" />
                    </div>
                  )}
                  <div>
                    <div
                      className={`rounded-xl px-3.5 py-2.5 text-sm leading-relaxed border ${
                        m.role === "user"
                          ? "bg-slate-900 text-white border-slate-900"
                          : m.urgency === "EMERGENCY"
                            ? "bg-red-50 text-red-900 border-red-200"
                            : "bg-slate-50 text-slate-800 border-slate-200"
                      }`}
                    >
                      {m.urgency === "EMERGENCY" && (
                        <div className="flex items-center gap-1 mb-1 text-xs font-semibold text-red-700">
                          <Siren className="h-3.5 w-3.5" />
                          Urgent
                        </div>
                      )}
                      {assistantMessageText(m)}
                    </div>
                    <div
                      className={`flex items-center gap-2 text-[10px] text-slate-400 mt-1 ${
                        m.role === "user" ? "justify-end" : ""
                      }`}
                    >
                      {m.timestamp && <span>{formatTime(m.timestamp)}</span>}
                      {m.role === "assistant" &&
                        m.content &&
                        ttsSupported &&
                        !m.content.startsWith("(") && (
                          <button
                            type="button"
                            onClick={() => speak(m, i)}
                            aria-label={speakingIdx === i ? "Stop reading aloud" : "Read aloud"}
                            title={speakingIdx === i ? "Stop reading aloud" : "Read aloud"}
                            className={cn(
                              "inline-flex items-center justify-center rounded p-0.5 transition-colors",
                              speakingIdx === i
                                ? "text-teal-600 hover:text-teal-700"
                                : "text-slate-400 hover:text-slate-700"
                            )}
                          >
                            {speakingIdx === i ? (
                              <VolumeX className="h-3.5 w-3.5" />
                            ) : (
                              <Volume2 className="h-3.5 w-3.5" />
                            )}
                          </button>
                        )}
                    </div>
                  </div>
                </div>
              </motion.div>
            ))}
            {waitingForFirstToken && (
              <div className="flex justify-start">
                <div className="flex items-end gap-2">
                  <div className="h-7 w-7 rounded-full bg-slate-100 flex items-center justify-center shrink-0">
                    <UserRound className="h-3.5 w-3.5 text-slate-600" />
                  </div>
                  <div className="rounded-xl px-4 py-3 bg-slate-50 border border-slate-200 flex gap-1">
                    <span className="h-1.5 w-1.5 rounded-full bg-slate-400 animate-bounce" style={{ animationDelay: "0ms" }} />
                    <span className="h-1.5 w-1.5 rounded-full bg-slate-400 animate-bounce" style={{ animationDelay: "150ms" }} />
                    <span className="h-1.5 w-1.5 rounded-full bg-slate-400 animate-bounce" style={{ animationDelay: "300ms" }} />
                  </div>
                </div>
              </div>
            )}
            {lastError && (
              <div className="flex justify-center">
                <Button size="sm" variant="subtle" onClick={retry} className="text-xs">
                  Retry last message
                </Button>
              </div>
            )}
          </div>

          <div className="px-4 pt-2 pb-1 flex flex-wrap gap-1.5 border-t border-slate-100">
            {STARTERS.map((s) => (
              <Button
                key={s}
                size="sm"
                variant="subtle"
                onClick={() => send(s)}
                disabled={pending}
                className="text-xs h-7 rounded-full"
              >
                {s}
              </Button>
            ))}
          </div>

          <div className="px-4 pb-4 pt-2">
            <div className="flex gap-2 items-end">
              <textarea
                value={input}
                onChange={(e) => setInput(e.target.value)}
                placeholder={
                  listening
                    ? "Listening… speak now, then review and press Enter"
                    : "Describe your symptoms or ask a healthcare question..."
                }
                rows={2}
                className="flex-1 resize-none rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-slate-900 focus:border-transparent"
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey) {
                    e.preventDefault();
                    send(input);
                  }
                }}
              />
              <Button
                onClick={toggleMic}
                disabled={pending}
                size="icon"
                variant={listening ? "secondary" : "subtle"}
                aria-label={listening ? "Stop voice input" : "Start voice input"}
                title={
                  !micSupported
                    ? "Speech recognition not supported in this browser"
                    : listening
                      ? "Stop voice input"
                      : "Speak your message"
                }
                className={cn(listening && "text-red-600 animate-pulse")}
              >
                {listening ? <MicOff className="h-4 w-4" /> : <Mic className="h-4 w-4" />}
              </Button>
              {pending ? (
                <Button
                  onClick={stopResponse}
                  variant="emergency"
                  className="shrink-0"
                  size="icon"
                  aria-label="Stop response"
                  title="Stop response"
                >
                  <Square className="h-4 w-4" />
                </Button>
              ) : (
                <Button
                  onClick={() => send(input)}
                  disabled={!input.trim()}
                  className="shrink-0"
                  size="icon"
                  aria-label="Send message"
                  title="Send message"
                >
                  <SendHorizonal className="h-4 w-4" />
                </Button>
              )}
            </div>
            {listening && (
              <div className="text-xs text-red-600 mt-1.5">
                Listening… speak now — the text is editable before you send it.
              </div>
            )}
          </div>
        </div>

        <div className="w-full lg:w-[38%] bg-white rounded-xl shadow-sm border border-slate-200 flex flex-col h-[600px]">
          <div className="px-4 py-3 border-b border-slate-100 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Hospital className="h-4 w-4 text-teal-600" />
              <h2 className="text-sm font-semibold text-slate-900">Nearby Care</h2>
            </div>
            {dataSourceLabel && (
              <Badge className="bg-slate-50 text-slate-600 border-slate-200 text-[10px]">
                {dataSourceLabel === "google-places" ? "Google Places" : "Hospital database"}
              </Badge>
            )}
          </div>
          {dataSourceLabel === "internal-db" && <div className="px-4 pt-3"><FacilityReportedNotice /></div>}
          {allRecs.some((item) => item.isDemo) && <div className="px-4 pt-3"><DemoFacilityNotice /></div>}
          <div className="flex-1 overflow-y-auto p-4 space-y-3">
            {allRecs.length > 0 ? (
              allRecs.map((r, idx) => (
                <motion.div
                  key={r.id || idx}
                  initial={{ opacity: 0, y: 6 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.18, delay: idx * 0.05 }}
                  className="rounded-lg border border-slate-200 p-3 hover:shadow-sm transition-shadow"
                >
                  <div className="flex flex-wrap items-center gap-2"><div className="font-medium text-sm text-slate-900">{r.name}</div>{r.isDemo && <DemoDataBadge />}</div>
                  {r.address && <div className="text-xs text-slate-500 mt-0.5">{r.address}</div>}
                  <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5 mt-1 text-xs text-slate-600">
                    <span>{typeof r.distanceKm === "number" ? `${r.distanceKm} km` : "Distance unavailable"}</span>
                    {typeof r.rating === "number" && (
                      <span className="flex items-center gap-0.5">
                        <Star className="h-3 w-3 fill-amber-400 text-amber-400" />
                        {r.rating}
                        {typeof r.reviewCount === "number" && ` (${r.reviewCount})`}
                      </span>
                    )}
                    {r.openingStatus && <span>{r.openingStatus}</span>}
                  </div>
                  {!r.isDemo && r.phone && (
                    <div className="flex items-center gap-1 mt-1 text-xs text-slate-600">
                      <PhoneCall className="h-3 w-3" />
                      {r.phone}
                    </div>
                  )}
                  <div className="flex gap-2 mt-2">
                    <a
                      href={hospitalDetailsHref(r, embedded)}
                      target={r.id?.startsWith("gplaces_") ? "_blank" : undefined}
                      rel="noreferrer"
                      className={cn(buttonVariants({ variant: "secondary", size: "sm" }), "text-xs h-7")}
                    >
                      View Details
                    </a>
                    {!r.isDemo && <a
                      href={directionsHref(r)}
                      target="_blank"
                      rel="noreferrer"
                      className={cn(buttonVariants({ variant: "secondary", size: "sm" }), "text-xs h-7")}
                    >
                      Directions
                    </a>}
                  </div>
                </motion.div>
              ))
            ) : (
              <div className="text-center text-slate-400 text-sm py-10">
                <Hospital className="h-8 w-8 mx-auto mb-2 opacity-40" />
                No hospitals found yet.
                <div className="text-xs mt-1">
                  {location
                    ? "Try a different message or broaden your search area."
                    : "Select a location first, then ask Jeevan AI for nearby care."}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
