import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { auditHospitalChange, serviceKey, withHospitalApi } from "@/lib/hospital/portal-api";
import { fail, ok, parseBody } from "@/lib/api-helpers";

const serviceSchema = z.object({
  name: z.string().trim().min(2).max(80),
  department: z.string().trim().max(80).optional().default(""),
  status: z.enum(["AVAILABLE", "LIMITED", "UNAVAILABLE"]),
  hours: z.string().trim().min(2).max(80),
  description: z.string().trim().max(500).optional().default(""),
});


async function departmentExists(hospitalId: string, name: string) {
  if (!name) return true;
  const departments = await prisma.hospitalDepartment.findMany({ where: { hospitalId }, select: { name: true } });
  return departments.some((department) => department.name.toLowerCase() === name.toLowerCase());
}

export const GET = withHospitalApi(async (_req, { hospital }) => {
  const services = await prisma.service.findMany({ where: { hospitalId: hospital.id }, orderBy: { name: "asc" } });
  return ok({ services });
});

export const POST = withHospitalApi(async (req, { hospital, session }) => {
  const parsed = await parseBody(req, serviceSchema);
  if (parsed.error) return parsed.error;
  if (!(await departmentExists(hospital.id, parsed.data.department ?? ""))) return fail(422, "Choose a department from this hospital.");
  const key = serviceKey(parsed.data.name);
  if (!key) return fail(422, "Service name must contain a letter or number.");
  const existing = await prisma.service.findFirst({ where: { hospitalId: hospital.id, key } });
  if (existing) return fail(409, "A service with this name already exists.");
  const service = await prisma.service.create({
    data: { hospitalId: hospital.id, key, name: parsed.data.name, department: parsed.data.department, status: parsed.data.status, hours: parsed.data.hours, details: parsed.data.description },
  });
  await auditHospitalChange({ session, hospital }, "SERVICE_CREATED", "Service", service.id, { name: service.name });
  return ok({ service }, { status: 201 });
}, { limit: 30, windowMs: 60_000, keyPrefix: "hospital-services" });
