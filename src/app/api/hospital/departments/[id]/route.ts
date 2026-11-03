import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { auditHospitalChange, hospitalResourceId, withHospitalApi } from "@/lib/hospital/portal-api";
import { fail, ok, parseBody } from "@/lib/api-helpers";

const patchSchema = z.object({
  name: z.string().trim().min(2).max(80).optional(),
  head: z.string().trim().min(2).max(100).optional(),
  status: z.enum(["ACTIVE", "LIMITED", "INACTIVE"]).optional(),
  location: z.string().trim().max(120).optional(),
  description: z.string().trim().max(500).optional(),
}).refine((value) => Object.keys(value).length > 0);

export const PATCH = withHospitalApi(async (req, { hospital, session }) => {
  const id = hospitalResourceId(req, "departments");
  if (!id) return fail(400, "Department ID is required.");
  const parsed = await parseBody(req, patchSchema);
  if (parsed.error) return parsed.error;
  const existing = await prisma.hospitalDepartment.findFirst({ where: { id, hospitalId: hospital.id } });
  if (!existing) return fail(404, "Department not found in your hospital.");
  if (parsed.data.name && parsed.data.name.toLowerCase() !== existing.name.toLowerCase()) {
    const duplicate = await prisma.hospitalDepartment.findFirst({ where: { hospitalId: hospital.id, name: { equals: parsed.data.name } } });
    if (duplicate) return fail(409, "A department with this name already exists.");
  }
  const department = await prisma.hospitalDepartment.update({ where: { id }, data: parsed.data });
  await auditHospitalChange({ session, hospital }, "DEPARTMENT_UPDATED", "HospitalDepartment", id, parsed.data);
  return ok({ department });
}, { limit: 60, windowMs: 60_000, keyPrefix: "hospital-department-update" });
