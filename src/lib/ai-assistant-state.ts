export interface AssistantConversationMessage {
  role: "user" | "assistant";
  content: string;
  interrupted?: boolean;
}

export const INTERRUPTED_RESPONSE_NOTICE =
  "Response stopped — incomplete and excluded from conversation history.";

export function isAssistantAbortError(error: unknown) {
  return typeof error === "object" && error !== null && "name" in error && error.name === "AbortError";
}

export function assistantHistoryPayload(messages: readonly AssistantConversationMessage[]) {
  return messages
    .filter((message) => !message.interrupted && message.content.trim().length > 0)
    .slice(-10)
    .map(({ role, content }) => ({ role, content }));
}

export function assistantMessageText(message: AssistantConversationMessage) {
  return message.interrupted ? INTERRUPTED_RESPONSE_NOTICE : message.content;
}

export function ensureAssistantStreamCompleted(completed: boolean, aborted: boolean) {
  if (completed) return;
  const error = new Error(
    aborted ? "The AI response was stopped before completion." : "The AI response was interrupted. Please try again."
  );
  if (aborted) error.name = "AbortError";
  throw error;
}

export function splitAssistantSseEvents(buffer: string, flush = false) {
  const events: string[] = [];
  const separator = /\r\n\r\n|\n\n|\r\r/g;
  let start = 0;
  let match: RegExpExecArray | null;

  while ((match = separator.exec(buffer)) !== null) {
    const event = buffer.slice(start, match.index);
    if (event.trim()) events.push(event);
    start = separator.lastIndex;
  }

  const remainder = buffer.slice(start);
  if (flush && remainder.trim()) {
    events.push(remainder);
    return { events, remainder: "" };
  }
  return { events, remainder };
}

export function assistantSseData(event: string) {
  const lines = event.split(/\r\n|\r|\n/).filter((line) => line.startsWith("data:"));
  if (lines.length === 0) return undefined;
  return lines.map((line) => line.slice(5).replace(/^ /, "")).join("\n");
}

export function settleAssistantRequestError<T extends AssistantConversationMessage>(
  messages: T[],
  assistantIndex: number,
  options: { aborted: boolean; streamExpected: boolean; streamCompleted: boolean }
): T[] {
  if (options.aborted) {
    if (options.streamCompleted) return messages;
    return messages.map((message, index) =>
      index === assistantIndex && message.role === "assistant"
        ? ({ ...message, content: "", interrupted: true } as T)
        : message
    );
  }
  return messages.filter(
    (message, index) =>
      index !== assistantIndex ||
      ((!options.streamExpected || options.streamCompleted) && message.content.trim().length > 0)
  );
}
