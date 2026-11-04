import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { verifyShareToken } from "@/lib/auth";
import { check } from "@/lib/rate-limit";
import { fail, ok, parseBody, withApi } from "@/lib/api-helpers";

const resolveSchema = z.object({
  token: z.string().min(1).max(4096),
  pin: z.string().trim().regex(/^\d{6}$/),
}).strict();

const resolveShare = withApi(
  async (req) => {
    const parsed = await parseBody(req, resolveSchema);
    if (parsed.error) return parsed.error;

    const userId = await verifyShareToken(parsed.data.token);
    if (!userId) {
      return fail(401, "This QR code has expired. Ask the patient to refresh it.");
    }

    const userLimit = check(`share-resolve-user:${userId}`, 10, 5 * 60_000);
    if (!userLimit.allowed) {
      return fail(429, "Too many PIN attempts. Ask the patient to refresh the QR code.", {
        retryAfterSeconds: userLimit.retryAfterSeconds,
      });
    }

    const user = await prisma.user.findFirst({
      where: {
        id: userId,
        role: "PATIENT",
        status: "ACTIVE",
        emailVerifiedAt: { not: null },
        sharePin: { not: null },
      },
      select: {
        name: true,
        age: true,
        gender: true,
        bloodGroup: true,
        allergies: true,
        conditions: true,
        medications: true,
        emergencyName: true,
        emergencyRel: true,
        emergencyPhone: true,
        sharePin: true,
      },
    });
    if (!user?.sharePin) return fail(404, "No shareable health profile found.");

    const bcrypt = (await import("bcryptjs")).default;
    const pinOk = await bcrypt.compare(parsed.data.pin, user.sharePin).catch(() => false);
    if (!pinOk) return fail(403, "Incorrect access PIN.");

    return ok({
      summary: {
        name: user.name,
        age: user.age,
        gender: user.gender,
        bloodGroup: user.bloodGroup,
        allergies: user.allergies,
        conditions: user.conditions,
        medications: user.medications,
        emergencyName: user.emergencyName,
        emergencyRel: user.emergencyRel,
        emergencyPhone: user.emergencyPhone,
      },
    });
  },
  { limit: 20, windowMs: 60_000, keyPrefix: "share-resolve" }
);

export async function POST(req: Request) {
  const response = await resolveShare(req);
  const headers = new Headers(response.headers);
  headers.set("Cache-Control", "no-store, max-age=0, private");
  headers.set("Pragma", "no-cache");
  headers.set("Referrer-Policy", "no-referrer");
  return new Response(response.body, { status: response.status, statusText: response.statusText, headers });
}
