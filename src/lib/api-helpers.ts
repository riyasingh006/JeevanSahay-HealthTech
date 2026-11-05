import { NextResponse } from "next/server";
import { ZodError, type ZodSchema } from "zod";
import { AuthError } from "./auth";
import { check } from "./rate-limit";
import { isTransientDatabaseError, safeErrorMetadata, shouldResetPrismaConnection } from "./database-errors";
import { resetPrismaConnection } from "./prisma";

export function ok<T>(data: T, init?: ResponseInit) {
  return NextResponse.json({ ok: true, data }, init);
}

export function fail(status: number, message: string, extra?: Record<string, unknown>) {
  return NextResponse.json({ ok: false, error: message, ...extra }, { status });
}

export async function parseBody<T>(
  req: Request,
  schema: ZodSchema<T>
): Promise<{ data: T; error?: never } | { data?: never; error: NextResponse }> {
  let raw: unknown;
  try {
    raw = await req.json();
  } catch {
    return { error: fail(400, "Request body must be valid JSON.") };
  }
  try {
    return { data: schema.parse(raw) };
  } catch (err) {
    if (err instanceof ZodError) {
      const first = err.issues[0];
      const path = first?.path?.join(".");
      return {
        error: fail(
          422,
          first ? `${path ? `${path}: ` : ""}${first.message}` : "Invalid input."
        ),
      };
    }
    return { error: fail(400, "Invalid request.") };
  }
}

/** Extract the dynamic `[id]` segment from a nested API route URL
 * (e.g. `/api/hospitals/<id>/beds`). Keeps wrapper handlers single-argument,
 * which is compatible with Next 15's generated route-type checks.
 */
export function idFromUrl(req: Request): string {
  const segments = new URL(req.url).pathname.split("/").filter(Boolean);
  const idx = segments.indexOf("hospitals");
  return idx >= 0 ? decodeURIComponent(segments[idx + 1] ?? "") : "";
}

/** Wrap an API handler with rate limiting + auth-error translation.
 * Handlers are intentionally single-argument: dynamic segments are parsed
 * from `req.url`, which keeps the wrapper compatible with Next 15's strict
 * generated route-type checks across static and dynamic routes alike.
 */
export function withApi(
  handler: (req: Request) => Promise<Response>,
  opts?: { limit?: number; windowMs?: number; keyPrefix?: string }
) {
  return async (req: Request): Promise<Response> => {
    if (opts) {
      const ip =
        req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown";
      const rl = check(
        `${opts.keyPrefix ?? "api"}:${ip}:${new URL(req.url).pathname}`,
        opts.limit ?? 60,
        opts.windowMs ?? 60_000
      );
      if (!rl.allowed) {
        return NextResponse.json(
          { ok: false, error: "Too many requests. Please slow down." },
          {
            status: 429,
            headers: { "Retry-After": String(rl.retryAfterSeconds) },
          }
        );
      }
    }

    try {
      return await handler(req);
    } catch (err) {
      if (err instanceof AuthError) return fail(err.status, err.message);
      if (isTransientDatabaseError(err)) {
        console.error("[api] transient database failure", safeErrorMetadata(err));
        if (shouldResetPrismaConnection(err)) await resetPrismaConnection();

        return NextResponse.json(
          { ok: false, error: "A temporary service problem occurred. Please try again shortly." },
          { status: 503 }
        );
      }
      console.error("[api] unhandled error", safeErrorMetadata(err));
      return fail(500, "Something went wrong on our side. Please try again.");
    }
  };
}
