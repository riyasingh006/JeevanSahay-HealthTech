import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireRole, hashPassword } from "@/lib/auth";
import { fail, ok, parseBody, withApi } from "@/lib/api-helpers";

const patchSchema = z.object({
  name: z.string().trim().min(2).max(80).optional(),
  phone: z.string().trim().max(16).optional(),
  age: z.coerce.number().int().min(0).max(120).optional(),
  gender: z.enum(["Male", "Female", "Other"]).optional(),
  location: z.string().trim().max(120).optional(),
  bloodGroup: z
    .enum(["A+", "A-", "B+", "B-", "AB+", "AB-", "O+", "O-"])
    .optional(),
  allergies: z.string().trim().max(300).optional(),
  conditions: z.string().trim().max(300).optional(),
  medications: z.string().trim().max(300).optional(),
  emergencyName: z.string().trim().max(80).optional(),
  emergencyRel: z.string().trim().max(40).optional(),
  emergencyPhone: z.string().trim().max(16).optional(),
});

export const GET = withApi(async () => {
  const session = await requireRole("PATIENT");
  const user = await prisma.user.findUnique({
    where: { id: session.sub },
    select: {
      id: true,
      name: true,
      email: true,
      role: true,
      phone: true,
      age: true,
      gender: true,
      location: true,
      bloodGroup: true,
      allergies: true,
      conditions: true,
      medications: true,
      emergencyName: true,
      emergencyRel: true,
      emergencyPhone: true,
      sharePin: true,
      createdAt: true,
    },
  });
  if (!user) return fail(404, "User not found.");
  const { sharePin, ...profile } = user;
  return ok({
    profile: { ...profile, hasSharePin: Boolean(sharePin) },
  });
});

export const PATCH = withApi(
  async (req) => {
    const session = await requireRole("PATIENT");
    const parsed = await parseBody(req, patchSchema);
    if (parsed.error) return parsed.error;

    const profile = await prisma.user.update({
      where: { id: session.sub },
      data: parsed.data,
    });
    return ok({
      profile: {
        name: profile.name,
        phone: profile.phone,
        age: profile.age,
        gender: profile.gender,
        location: profile.location,
        bloodGroup: profile.bloodGroup,
        allergies: profile.allergies,
        conditions: profile.conditions,
        medications: profile.medications,
        emergencyName: profile.emergencyName,
        emergencyRel: profile.emergencyRel,
        emergencyPhone: profile.emergencyPhone,
      },
    });
  },
  { limit: 30, windowMs: 60_000, keyPrefix: "profile" }
);

/** Set or rotate the Digital Health Profile share PIN. */
export const PUT = withApi(
  async (req) => {
    const session = await requireRole("PATIENT");
    const schema = z.object({
      currentPassword: z.string().min(1),
      newPin: z.string().regex(/^\d{6}$/, "PIN must be exactly 6 digits"),
    });
    const parsed = await parseBody(req, schema);
    if (parsed.error) return parsed.error;

    const user = await prisma.user.findUnique({ where: { id: session.sub } });
    if (!user) return fail(404, "User not found.");

    const bcrypt = (await import("bcryptjs")).default;
    if (!(await bcrypt.compare(parsed.data.currentPassword, user.passwordHash)))
      return fail(401, "Current password is incorrect.");

    await prisma.user.update({
      where: { id: session.sub },
      data: { sharePin: await hashPassword(parsed.data.newPin) },
    });
    return ok({ updated: true });
  },
  { limit: 5, windowMs: 60_000, keyPrefix: "share-pin" }
);
