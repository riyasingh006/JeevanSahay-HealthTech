const transientCodes = new Set([
  "P1001",
  "P1002",
  "P1017",
  "P2024",
  "57P01",
  "57P02",
  "57P03",
  "ECONNRESET",
  "ECONNREFUSED",
  "ETIMEDOUT",
  "EPIPE",
  "ENETUNREACH",
  "EHOSTUNREACH",
]);

const closedConnectionPattern = /kind:\s*Closed|connection (?:was )?(?:closed|reset)|server closed the connection|error in PostgreSQL connection/i;

function errorProperties(error: unknown): {
  name?: string;
  code?: string;
  message?: string;
  metaCode?: string;
  metaMessage?: string;
} {
  if (!error || typeof error !== "object") return {};
  const value = error as {
    name?: unknown;
    code?: unknown;
    message?: unknown;
    meta?: { code?: unknown; message?: unknown };
  };
  return {
    name: typeof value.name === "string" ? value.name : undefined,
    code: typeof value.code === "string" ? value.code : undefined,
    message: typeof value.message === "string" ? value.message : undefined,
    metaCode: typeof value.meta?.code === "string" ? value.meta.code : undefined,
    metaMessage: typeof value.meta?.message === "string" ? value.meta.message : undefined,
  };
}

function isTransientCode(code: string): boolean {
  return transientCodes.has(code) || /^08[A-Z0-9]{3}$/.test(code);
}

function isClosedConnection(error: unknown): boolean {
  const { name, message, metaMessage } = errorProperties(error);
  const combinedMessage = `${message ?? ""} ${metaMessage ?? ""}`;
  return closedConnectionPattern.test(combinedMessage) && (
    name?.startsWith("PrismaClient") === true ||
    /error in PostgreSQL connection/i.test(combinedMessage)
  );
}

export function databaseErrorCode(error: unknown): string | undefined {
  const { code, metaCode } = errorProperties(error);
  if (code === "P2010" && metaCode && isTransientCode(metaCode)) return metaCode;
  if (code && /^(?:P\d{4}|[A-Z][A-Z0-9_]{1,39})$/.test(code)) return code;
  if (isClosedConnection(error)) return "CONNECTION_CLOSED";
  return undefined;
}

export function isTransientDatabaseError(error: unknown): boolean {
  const code = databaseErrorCode(error);
  return Boolean((code && isTransientCode(code)) || isClosedConnection(error));
}

const resetCodes = new Set([
  "P1017",
  "57P01",
  "57P02",
  "57P03",
  "ECONNRESET",
  "EPIPE",
]);

export function shouldResetPrismaConnection(error: unknown): boolean {
  const code = databaseErrorCode(error);
  return Boolean(code && (code === "CONNECTION_CLOSED" || resetCodes.has(code) || /^08[A-Z0-9]{3}$/.test(code)));
}

export function safeErrorMetadata(error: unknown): { name: string; code?: string } {
  const { name } = errorProperties(error);
  const code = databaseErrorCode(error);
  return {
    name: name && /^[A-Za-z][A-Za-z0-9_$]{0,79}$/.test(name) ? name : "Error",
    ...(code ? { code } : {}),
  };
}
