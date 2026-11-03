import { prisma } from "@/lib/prisma";
import { requireRole, createShareToken, verifyShareToken } from "@/lib/auth";
import { fail, ok, withApi } from "@/lib/api-helpers";
import { check } from "@/lib/rate-limit";

/** Generate a short-lived signed QR token for the Digital Health Profile. */
export const POST = withApi(
  async () => {
    const session = await requireRole("PATIENT");
    const token = await createShareToken(session.sub);
    return ok({
      token,
      expiresInSeconds: 300,
      url: `/share/${token}`,
    });
  },
  { limit: 10, windowMs: 60_000, keyPrefix: "share-token" }
);

/**
 * Resolve a share token + PIN into a *limited* emergency summary.
 * The full medical profile is never returned through this endpoint.
 */
export const GET = withApi(
  async (req) => {
    const url = new URL(req.url);
    const token = url.searchParams.get("token") ?? "";
    const pin = (url.searchParams.get("pin") ?? "").trim();

    const userId = await verifyShareToken(token);
    if (!userId)
      return fail(401, "This QR code has expired. Ask the patient to refresh it.");
    const userLimit = check(`share-resolve-user:${userId}`, 10, 5 * 60_000);
    if (!userLimit.allowed) {
      return fail(429, "Too many PIN attempts. Ask the patient to refresh the QR code.", {
        retryAfterSeconds: userLimit.retryAfterSeconds,
      });
    }

    if (!/^\d{6}$/.test(pin))
      return fail(422, "Enter the patient's 6-digit access PIN.");

    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (!user?.sharePin) return fail(404, "No shareable health profile found.");

    const bcrypt = (await import("bcryptjs")).default;
    const pinOk = await bcrypt.compare(pin, user.sharePin).catch(() => false);
    if (!pinOk) return fail(403, "Incorrect access PIN.");

    // Deliberately minimal — critical information only.
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
