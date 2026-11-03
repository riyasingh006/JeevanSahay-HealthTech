import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { auditHospitalChange, withHospitalApi } from "@/lib/hospital/portal-api";
import { fail, ok, parseBody } from "@/lib/api-helpers";

const doctorSchema = z.object({
  name: z.string().trim().min(2).max(100),
  specialty: z.string().trim().min(2).max(60),
  department: z.string().trim().max(80).optional().default(""),
  qualification: z.string().trim().max(120).optional().default(""),
  experienceYears: z.coerce.number().int().min(0).max(70),
  availability: z.enum(["AVAILABLE", "LIMITED", "UNAVAILABLE"]),
  timings: z.string().trim().max(120).optional().default(""),
  phone: z.string().trim().max(24).optional().default(""),
  email: z.union([z.string().trim().email().max(254), z.literal("")]).optional().default(""),
});

async function validateDepartment(hospitalId: string, name: string) {
  if (!name) return true;
  const departments = await prisma.hospitalDepartment.findMany({ where: { hospitalId }, select: { name: true } });
  return departments.some((department) => department.name.toLowerCase() === name.toLowerCase());
}

export const GET = withHospitalApi(async (_req, { hospital }) => {
  const doctors = await prisma.doctor.findMany({ where: { hospitalId: hospital.id }, orderBy: { name: "asc" } });
  return ok({ doctors });
});

export const POST = withHospitalApi(async (req, { hospital, session }) => {
  const parsed = await parseBody(req, doctorSchema);
  if (parsed.error) return parsed.error;
  if (!(await validateDepartment(hospital.id, parsed.data.department ?? ""))) return fail(422, "Choose a department from this hospital.");
  const doctor = await prisma.doctor.create({ data: { ...parsed.data, hospitalId: hospital.id } });
  await auditHospitalChange({ session, hospital }, "DOCTOR_CREATED", "Doctor", doctor.id, { name: doctor.name, specialty: doctor.specialty });
  return ok({ doctor }, { status: 201 });
}, { limit: 40, windowMs: 60_000, keyPrefix: "hospital-doctors" });
