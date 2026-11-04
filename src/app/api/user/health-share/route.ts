import { prisma } from "@/lib/prisma";
import { requireRole, createShareToken } from "@/lib/auth";
import { fail, ok, withApi } from "@/lib/api-helpers";

const createShareLink = withApi(
  async () => {
    const session = await requireRole("PATIENT");
    const patient = await prisma.user.findFirst({
      where: {
        id: session.sub,
        role: "PATIENT",
        status: "ACTIVE",
        emailVerifiedAt: { not: null },
        sharePin: { not: null },
      },
      select: { id: true },
    });
    if (!patient) return fail(409, "Set a 6-digit health-share PIN before creating a share link.");

    const token = await createShareToken(session.sub);
    return ok(
      {
        token,
        expiresInSeconds: 300,
        url: `/share#${token}`,
      },
      { headers: { "Cache-Control": "no-store", "Referrer-Policy": "no-referrer" } }
    );
  },
  { limit: 10, windowMs: 60_000, keyPrefix: "share-token" }
);

export async function POST(req: Request) {
  const response = await createShareLink(req);
  const headers = new Headers(response.headers);
  headers.set("Cache-Control", "no-store, max-age=0");
  headers.set("Referrer-Policy", "no-referrer");
  return new Response(response.body, { status: response.status, statusText: response.statusText, headers });
}
