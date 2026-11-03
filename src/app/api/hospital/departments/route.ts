import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { auditHospitalChange, withHospitalApi } from "@/lib/hospital/portal-api";
import { fail, ok, parseBody } from "@/lib/api-helpers";

const departmentSchema = z.object({
  name: z.string().trim().min(2).max(80),
  head: z.string().trim().min(2).max(100),
  status: z.enum(["ACTIVE", "LIMITED", "INACTIVE"]),
  location: z.string().trim().max(120).optional().default(""),
  description: z.string().trim().max(500).optional().default(""),
});

export const GET = withHospitalApi(async (_req, { hospital }) => {
  const departments = await prisma.hospitalDepartment.findMany({ where: { hospitalId: hospital.id }, orderBy: { name: "asc" } });
  return ok({ departments });
});

export const POST = withHospitalApi(async (req, { hospital, session }) => {
  const parsed = await parseBody(req, departmentSchema);
  if (parsed.error) return parsed.error;
  const existing = await prisma.hospitalDepartment.findMany({ where: { hospitalId: hospital.id }, select: { name: true } });
  if (existing.some((item) => item.name.toLowerCase() === parsed.data.name.toLowerCase())) {
    return fail(409, "A department with this name already exists.");
  }
  const department = await prisma.hospitalDepartment.create({ data: { ...parsed.data, hospitalId: hospital.id } });
  await auditHospitalChange({ session, hospital }, "DEPARTMENT_CREATED", "HospitalDepartment", department.id, { name: department.name });
  return ok({ department }, { status: 201 });
}, { limit: 30, windowMs: 60_000, keyPrefix: "hospital-departments" });
