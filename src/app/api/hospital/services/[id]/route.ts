import { z } from "zod";
import { prisma } from "@/lib/prisma";
import {
  auditHospitalChange,
  hospitalResourceId,
  notifySavedHospitalUsers,
  serviceKey,
  withHospitalApi,
} from "@/lib/hospital/portal-api";
import { fail, ok, parseBody } from "@/lib/api-helpers";

const patchSchema = z.object({
  name: z.string().trim().min(2).max(80).optional(),
  department: z.string().trim().max(80).optional(),
  status: z.enum(["AVAILABLE", "LIMITED", "UNAVAILABLE"]).optional(),
  hours: z.string().trim().min(2).max(80).optional(),
  description: z.string().trim().max(500).optional(),
}).refine((value) => Object.keys(value).length > 0);

async function departmentExists(hospitalId: string, name: string) {
  if (!name) return true;
  const departments = await prisma.hospitalDepartment.findMany({ where: { hospitalId }, select: { name: true } });
  return departments.some((department) => department.name.toLowerCase() === name.toLowerCase());
}

export const PATCH = withHospitalApi(async (req, context) => {
  const id = hospitalResourceId(req, "services");
  if (!id) return fail(400, "Service ID is required.");
  const parsed = await parseBody(req, patchSchema);
  if (parsed.error) return parsed.error;
  if (parsed.data.department !== undefined && !(await departmentExists(context.hospital.id, parsed.data.department))) {
    return fail(422, "Choose a department from your hospital.");
  }
  const existing = await prisma.service.findFirst({ where: { id, hospitalId: context.hospital.id } });
  if (!existing) return fail(404, "Service not found in your hospital.");
  const key = parsed.data.name === undefined ? existing.key : serviceKey(parsed.data.name);
  if (!key) return fail(422, "Service name must contain a letter or number.");
  if (key !== existing.key) {
    const duplicate = await prisma.service.findFirst({ where: { hospitalId: context.hospital.id, key } });
    if (duplicate) return fail(409, "A service with this name already exists.");
  }

  const service = await prisma.service.update({
    where: { id },
    data: {
      ...(parsed.data.name === undefined ? {} : { key, name: parsed.data.name }),
      ...(parsed.data.department === undefined ? {} : { department: parsed.data.department }),
      ...(parsed.data.status === undefined ? {} : { status: parsed.data.status }),
      ...(parsed.data.hours === undefined ? {} : { hours: parsed.data.hours }),
      ...(parsed.data.description === undefined ? {} : { details: parsed.data.description }),
    },
  });
  if (parsed.data.status !== undefined) {
    await prisma.hospital.update({ where: { id: context.hospital.id }, data: { lastAvailabilityUpdate: new Date() } });
    await notifySavedHospitalUsers(context.hospital.id, {
      title: "Hospital service availability updated",
      body: `${service.name ?? service.key.replaceAll("_", " ")} availability has changed.`,
      link: `/hospitals/${context.hospital.id}`,
    });
  }
  await auditHospitalChange(context, "SERVICE_UPDATED", "Service", id, { changedFields: Object.keys(parsed.data) });
  return ok({ service });
}, { limit: 60, windowMs: 60_000, keyPrefix: "hospital-service-update" });

export const DELETE = withHospitalApi(async (req, context) => {
  const id = hospitalResourceId(req, "services");
  if (!id) return fail(400, "Service ID is required.");
  const service = await prisma.service.findFirst({ where: { id, hospitalId: context.hospital.id } });
  if (!service) return fail(404, "Service not found in your hospital.");
  await prisma.service.delete({ where: { id } });
  await prisma.hospital.update({ where: { id: context.hospital.id }, data: { lastAvailabilityUpdate: new Date() } });
  await notifySavedHospitalUsers(context.hospital.id, {
    title: "Hospital services updated",
    body: "A hospital you follow has updated its services.",
    link: `/hospitals/${context.hospital.id}`,
  });
  await auditHospitalChange(context, "SERVICE_DELETED", "Service", id, { name: service.name ?? service.key });
  return ok({ deleted: true });
}, { limit: 30, windowMs: 60_000, keyPrefix: "hospital-service-delete" });
