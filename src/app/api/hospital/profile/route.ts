import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { auditHospitalChange, withHospitalApi } from "@/lib/hospital/portal-api";
import { fail, ok, parseBody } from "@/lib/api-helpers";

const profileSchema = z.object({
  name: z.string().trim().min(2).max(120),
  type: z.enum(["GOVERNMENT", "PRIVATE", "TRUST", "PSU"]),
  registrationNumber: z.string().trim().max(80),
  addressLine: z.string().trim().min(4).max(180),
  city: z.string().trim().min(2).max(80),
  state: z.string().trim().min(2).max(80),
  pincode: z.string().trim().regex(/^\d{6}$/),
  phone: z.string().trim().regex(/^[+0-9 ()-]{6,24}$/),
  emergencyPhone: z.string().trim().max(24),
  email: z.union([z.string().trim().email().max(254), z.literal("")]),
  website: z.union([z.string().trim().url().max(240), z.literal("")]),
  accreditation: z.string().trim().max(100),
  established: z.coerce.number().int().min(1800).max(new Date().getFullYear()),
  about: z.string().trim().max(2000),
});

export const PATCH = withHospitalApi(async (req, context) => {
  const parsed = await parseBody(req, profileSchema);
  if (parsed.error) return parsed.error;
  const data = parsed.data;
  if (
    data.name !== context.hospital.name ||
    data.type !== context.hospital.type ||
    data.registrationNumber !== (context.hospital.registrationNumber ?? "")
  ) {
    return fail(403, "Hospital name, type, and registration number are verified identity fields. Contact the administrator to change them.");
  }
  const updated = await prisma.hospital.update({
    where: { id: context.hospital.id },
    data: {
      name: data.name,
      addressLine: data.addressLine,
      city: data.city,
      state: data.state,
      pincode: data.pincode,
      phone: data.phone,
      emergencyPhone: data.emergencyPhone || null,
      email: data.email || null,
      website: data.website || null,
      accreditation: data.accreditation || null,
      established: data.established,
      about: data.about || null,
    },
  });
  await auditHospitalChange(context, "PROFILE_UPDATED", "Hospital", updated.id, {
    changedFields: ["name", "addressLine", "city", "state", "pincode", "phone", "emergencyPhone", "email", "website", "accreditation", "established", "about"],
  });
  return ok({ updated: true });
}, { limit: 20, windowMs: 60_000, keyPrefix: "hospital-profile" });
