import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { auditHospitalChange, hospitalResourceId, withHospitalApi } from "@/lib/hospital/portal-api";
import { fail, ok, parseBody } from "@/lib/api-helpers";

const patchSchema = z.object({
  name: z.string().trim().min(2).max(100).optional(),
  specialty: z.string().trim().min(2).max(60).optional(),
  department: z.string().trim().max(80).optional(),
  qualification: z.string().trim().max(120).optional(),
  experienceYears: z.coerce.number().int().min(0).max(70).optional(),
  availability: z.enum(["AVAILABLE", "LIMITED", "UNAVAILABLE"]).optional(),
  timings: z.string().trim().max(120).optional(),
  phone: z.string().trim().max(24).optional(),
  email: z.union([z.string().trim().email().max(254), z.literal("")]).optional(),
}).refine((value) => Object.keys(value).length > 0);

export const PATCH = withHospitalApi(async (req, { hospital, session }) => {
  const id = hospitalResourceId(req, "doctors");
  if (!id) return fail(400, "Doctor ID is required.");
  const parsed = await parseBody(req, patchSchema);
  if (parsed.error) return parsed.error;
  const existing = await prisma.doctor.findFirst({ where: { id, hospitalId: hospital.id } });
  if (!existing) return fail(404, "Doctor not found in your hospital.");
  if (parsed.data.department !== undefined && !(await validateDepartment(hospital.id, parsed.data.department))) {
    return fail(422, "Choose a department from this hospital.");
  }
  const doctor = await prisma.doctor.update({ where: { id }, data: parsed.data });
  await auditHospitalChange({ session, hospital }, "DOCTOR_UPDATED", "Doctor", id, parsed.data);
  return ok({ doctor });
}, { limit: 60, windowMs: 60_000, keyPrefix: "hospital-doctor-update" });

async function validateDepartment(hospitalId: string, name: string) {
  if (!name) return true;
  const departments = await prisma.hospitalDepartment.findMany({ where: { hospitalId }, select: { name: true } });
  return departments.some((department) => department.name.toLowerCase() === name.toLowerCase());
}

export const DELETE = withHospitalApi(async (req, { hospital, session }) => {
  const id = hospitalResourceId(req, "doctors");
  if (!id) return fail(400, "Doctor ID is required.");
  const doctor = await prisma.doctor.findFirst({ where: { id, hospitalId: hospital.id } });
  if (!doctor) return fail(404, "Doctor not found in your hospital.");
  const updated = await prisma.doctor.update({ where: { id }, data: { availability: "UNAVAILABLE" } });
  await auditHospitalChange({ session, hospital }, "DOCTOR_DEACTIVATED", "Doctor", id, { name: doctor.name });
  return ok({ doctor: updated, deactivated: true });
}, { limit: 30, windowMs: 60_000, keyPrefix: "hospital-doctor-delete" });
