import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { auditHospitalChange, hospitalResourceId, withHospitalApi } from "@/lib/hospital/portal-api";
import { fail, ok, parseBody } from "@/lib/api-helpers";

const patchSchema = z.object({
  status: z.enum(["RECEIVED", "IN_TREATMENT", "STABILIZED", "DISCHARGED"]),
});

const transitions: Record<string, string[]> = {
  RECEIVED: ["IN_TREATMENT", "STABILIZED"],
  IN_TREATMENT: ["STABILIZED", "DISCHARGED"],
  STABILIZED: ["IN_TREATMENT", "DISCHARGED"],
  DISCHARGED: [],
};

export const PATCH = withHospitalApi(async (req, context) => {
  const id = hospitalResourceId(req, "emergencies");
  if (!id) return fail(400, "Emergency case ID is required.");
  const parsed = await parseBody(req, patchSchema);
  if (parsed.error) return parsed.error;
  const existing = await prisma.emergencyCase.findFirst({
    where: { id, hospitalId: context.hospital.id },
  });
  if (!existing) return fail(404, "Emergency case not found in your hospital.");
  if (!transitions[existing.status]?.includes(parsed.data.status)) {
    return fail(409, "This emergency case status cannot be changed to the selected value.");
  }
  const updated = await prisma.emergencyCase.updateMany({
    where: { id, hospitalId: context.hospital.id, status: existing.status },
    data: { status: parsed.data.status },
  });
  if (updated.count !== 1) return fail(409, "This case was updated elsewhere. Refresh and try again.");
  await auditHospitalChange(context, "EMERGENCY_STATUS_UPDATED", "EmergencyCase", id, {
    status: parsed.data.status,
  });
  return ok({ updated: true, status: parsed.data.status });
}, { limit: 60, windowMs: 60_000, keyPrefix: "hospital-emergency-update" });
