import { Prisma } from "@prisma/client";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import {
  auditHospitalChange,
  hospitalResourceId,
  notifySavedHospitalUsers,
  withHospitalApi,
} from "@/lib/hospital/portal-api";
import { fail, ok, parseBody } from "@/lib/api-helpers";

const bedTypeSchema = z.enum(["GENERAL", "ICU", "EMERGENCY", "PRIVATE", "PEDIATRIC", "MATERNITY", "ISOLATION", "VENTILATOR"]);
const patchSchema = z.object({
  ward: z.string().trim().min(2).max(80).optional(),
  bedType: bedTypeSchema.optional(),
  department: z.string().trim().max(80).optional(),
  status: z.enum(["AVAILABLE", "OCCUPIED", "RESERVED", "MAINTENANCE"]).optional(),
}).refine((value) => Object.values(value).some((item) => item !== undefined));

class InventoryConflictError extends Error {}

async function adjustInventory(
  tx: Prisma.TransactionClient,
  hospitalId: string,
  category: string,
  totalDelta: number,
  availableDelta: number
) {
  const current = await tx.bedInventory.findUnique({ where: { hospitalId_category: { hospitalId, category } } });
  if (!current) {
    if (totalDelta <= 0 || availableDelta < 0 || availableDelta > totalDelta) throw new InventoryConflictError();
    await tx.bedInventory.create({ data: { hospitalId, category, total: totalDelta, available: availableDelta } });
    return;
  }
  const total = current.total + totalDelta;
  const available = current.available + availableDelta;
  if (total < 0 || available < 0 || available > total) throw new InventoryConflictError();
  await tx.bedInventory.update({
    where: { id: current.id },
    data: { total, available },
  });
}

export const PATCH = withHospitalApi(async (req, { hospital, session }) => {
  const code = hospitalResourceId(req, "beds").toUpperCase();
  if (!code) return fail(400, "Bed ID is required.");
  const parsed = await parseBody(req, patchSchema);
  if (parsed.error) return parsed.error;
  const existing = await prisma.hospitalBed.findFirst({ where: { hospitalId: hospital.id, code } });
  if (!existing) return fail(404, "Bed not found in your hospital.");

  const departmentName = parsed.data.department;
  if (departmentName) {
    const department = await prisma.hospitalDepartment.findFirst({
      where: { hospitalId: hospital.id, name: { equals: departmentName }, status: "ACTIVE" },
      select: { id: true },
    });
    if (!department) return fail(422, "Choose an active department from your hospital.");
  }

  const category = parsed.data.bedType ?? existing.category;
  const status = parsed.data.status ?? existing.status;
  const department = departmentName === undefined ? existing.department : departmentName || null;
  let updated;
  try {
    updated = await prisma.$transaction(async (tx) => {
      if (category !== existing.category) {
        await adjustInventory(tx, hospital.id, existing.category, -1, existing.status === "AVAILABLE" ? -1 : 0);
        await adjustInventory(tx, hospital.id, category, 1, status === "AVAILABLE" ? 1 : 0);
      } else if (status !== existing.status) {
        await adjustInventory(tx, hospital.id, category, 0, (status === "AVAILABLE" ? 1 : 0) - (existing.status === "AVAILABLE" ? 1 : 0));
      }
      const result = await tx.hospitalBed.update({
        where: { id: existing.id },
        data: { ward: parsed.data.ward ?? existing.ward, category, department, status },
      });
      await tx.hospital.update({ where: { id: hospital.id }, data: { lastAvailabilityUpdate: new Date() } });
      return result;
    });
  } catch (error) {
    if (error instanceof InventoryConflictError) return fail(409, "Bed totals are inconsistent. Refresh hospital inventory before changing this bed.");
    throw error;
  }

  await auditHospitalChange({ session, hospital }, "BED_UPDATED", "HospitalBed", updated.id, { code, category, status });
  try {
    await notifySavedHospitalUsers(hospital.id, { title: "Bed availability updated", body: "A hospital you follow has updated its bed records.", link: `/hospitals/${hospital.id}` });
  } catch (error) {
    console.error("[hospital] saved-hospital notification fan-out failed", error);
  }
  return ok({ bed: updated });
}, { limit: 60, windowMs: 60_000, keyPrefix: "hospital-bed-update" });

export const DELETE = withHospitalApi(async (req, { hospital, session }) => {
  const code = hospitalResourceId(req, "beds").toUpperCase();
  if (!code) return fail(400, "Bed ID is required.");
  const existing = await prisma.hospitalBed.findFirst({ where: { hospitalId: hospital.id, code } });
  if (!existing) return fail(404, "Bed not found in your hospital.");
  if (["OCCUPIED", "RESERVED"].includes(existing.status)) {
    return fail(409, "Occupied or reserved beds cannot be removed. Update their status first.");
  }

  try {
    await prisma.$transaction(async (tx) => {
      await adjustInventory(tx, hospital.id, existing.category, -1, existing.status === "AVAILABLE" ? -1 : 0);
      await tx.hospitalBed.delete({ where: { id: existing.id } });
      await tx.hospital.update({ where: { id: hospital.id }, data: { lastAvailabilityUpdate: new Date() } });
    });
  } catch (error) {
    if (error instanceof InventoryConflictError) return fail(409, "Bed totals are inconsistent. Refresh hospital inventory before deleting this bed.");
    throw error;
  }

  await auditHospitalChange({ session, hospital }, "BED_DELETED", "HospitalBed", existing.id, { code });
  try {
    await notifySavedHospitalUsers(hospital.id, { title: "Bed availability updated", body: "A hospital you follow has updated its bed records.", link: `/hospitals/${hospital.id}` });
  } catch (error) {
    console.error("[hospital] saved-hospital notification fan-out failed", error);
  }
  return ok({ deleted: true });
}, { limit: 30, windowMs: 60_000, keyPrefix: "hospital-bed-delete" });
