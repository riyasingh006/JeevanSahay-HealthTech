import { randomBytes } from "node:crypto";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { auditHospitalChange, withHospitalApi } from "@/lib/hospital/portal-api";
import { fail, ok, parseBody } from "@/lib/api-helpers";

const createSchema = z.object({
  reference: z.string().trim().max(24).optional().default(""),
  patientRef: z.string().trim().min(2).max(60),
  age: z.coerce.number().int().min(0).max(120).nullable().optional(),
  condition: z.string().trim().min(2).max(200),
  severity: z.enum(["CRITICAL", "URGENT", "MODERATE"]),
  department: z.string().trim().max(80).optional().default(""),
  location: z.string().trim().max(120).optional().default(""),
});

export const GET = withHospitalApi(async (_req, { hospital }) => {
  const emergencyCases = await prisma.emergencyCase.findMany({
    where: { hospitalId: hospital.id },
    orderBy: { reportedAt: "desc" },
    take: 200,
  });
  return ok({ emergencyCases });
});

export const POST = withHospitalApi(async (req, context) => {
  const parsed = await parseBody(req, createSchema);
  if (parsed.error) return parsed.error;
  const data = parsed.data;
  if (data.department) {
    const department = await prisma.hospitalDepartment.findFirst({
      where: { hospitalId: context.hospital.id, name: data.department },
      select: { id: true },
    });
    if (!department) return fail(422, "Choose a department from your hospital.");
  }
  const reference = data.reference || `ER-${randomBytes(4).toString("hex").toUpperCase()}`;
  const emergencyCase = await prisma.emergencyCase.create({
    data: {
      hospitalId: context.hospital.id,
      reference,
      patientRef: data.patientRef,
      age: data.age ?? null,
      condition: data.condition,
      severity: data.severity,
      department: data.department || null,
      location: data.location || null,
    },
  });
  await auditHospitalChange(context, "EMERGENCY_RECORDED", "EmergencyCase", emergencyCase.id, {
    reference: emergencyCase.reference,
    severity: emergencyCase.severity,
  });
  return ok({ emergencyCase }, { status: 201 });
}, { limit: 30, windowMs: 60_000, keyPrefix: "hospital-emergencies" });
