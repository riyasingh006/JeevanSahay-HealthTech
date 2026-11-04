import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { getClientIp, hashPassword, writeAudit } from "@/lib/auth";
import { issueAuthOtp } from "@/lib/otp";
import { check } from "@/lib/rate-limit";
import { fail, ok, parseBody, withApi } from "@/lib/api-helpers";

const strongPassword = z
  .string()
  .min(12, "Use at least 12 characters")
  .max(72, "Password is too long")
  .regex(/[a-z]/, "Include a lower-case letter")
  .regex(/[A-Z]/, "Include an upper-case letter")
  .regex(/[0-9]/, "Include a number")
  .refine((password) => Buffer.byteLength(password, "utf8") <= 72, "Password is too long");

const schema = z
  .object({
    name: z.string().trim().min(2).max(80),
    email: z.string().trim().toLowerCase().email().max(254),
    password: strongPassword,
    phone: z.string().trim().min(7).max(24),
    role: z.enum(["PATIENT", "HOSPITAL_ADMIN"]).default("PATIENT"),
    hospitalName: z.string().trim().min(2).max(120).optional(),
    registrationNumber: z.string().trim().max(80).optional(),
    hospitalType: z.enum(["GOVERNMENT", "PRIVATE", "TRUST", "PSU"]).optional(),
    addressLine: z.string().trim().min(5).max(200).optional(),
    city: z.string().trim().min(2).max(80).optional(),
    state: z.string().trim().min(2).max(80).optional(),
    pincode: z.string().trim().min(4).max(12).optional(),
    website: z.string().trim().url().max(255).optional().or(z.literal("")),
  })
  .superRefine((data, ctx) => {
    if (data.role !== "HOSPITAL_ADMIN") return;
    for (const field of ["hospitalName", "addressLine", "city", "state", "pincode"] as const) {
      if (!data[field]) {
        ctx.addIssue({ code: "custom", path: [field], message: "Required for a hospital application" });
      }
    }
  });

export const POST = withApi(
  async (req) => {
    const parsed = await parseBody(req, schema);
    if (parsed.error) return parsed.error;
    const data = parsed.data;
    const ip = await getClientIp();
    const emailLimit = check(`register-email:${data.email}`, 5, 60 * 60 * 1000);
    if (!emailLimit.allowed) {
      return fail(429, "Too many registration attempts. Try again later.", {
        retryAfterSeconds: emailLimit.retryAfterSeconds,
      });
    }

    const existing = await prisma.user.findUnique({ where: { email: data.email } });
    if (existing) return fail(409, "An account with this email already exists. Sign in or verify your email.");

    let user;
    try {
      user = await prisma.user.create({
        data: {
          name: data.name,
          email: data.email,
          phone: data.phone,
          passwordHash: await hashPassword(data.password),
          role: data.role,
          status: "PENDING_VERIFICATION",
          ...(data.role === "HOSPITAL_ADMIN"
            ? {
                hospitalApplication: {
                  create: {
                    hospitalName: data.hospitalName!,
                    registrationNumber: data.registrationNumber || null,
                    hospitalType: data.hospitalType ?? "PRIVATE",
                    addressLine: data.addressLine!,
                    city: data.city!,
                    state: data.state!,
                    pincode: data.pincode!,
                    phone: data.phone,
                    email: data.email,
                    website: data.website || null,
                  },
                },
              }
            : {}),
        },
      });
    } catch (error) {
      if (error && typeof error === "object" && "code" in error && error.code === "P2002") {
        return fail(409, "An account with this email already exists. Sign in or verify your email.");
      }
      throw error;
    }

    const delivery = await issueAuthOtp({
      userId: user.id,
      email: user.email,
      name: user.name,
      purpose: "EMAIL_VERIFICATION",
    });
    await writeAudit({
      actorUserId: user.id,
      actorEmail: user.email,
      action: data.role === "PATIENT" ? "AUTH_REGISTER" : "HOSPITAL_APPLICATION_SUBMITTED",
      entityType: data.role === "PATIENT" ? "User" : "HospitalApplication",
      entityId: user.id,
      ip,
    });

    return ok(
      {
        emailVerificationRequired: true,
        email: user.email,
        deliveryPending: !delivery.sent,
      },
      { status: 201 }
    );
  },
  { limit: 10, windowMs: 60_000, keyPrefix: "register" }
);
