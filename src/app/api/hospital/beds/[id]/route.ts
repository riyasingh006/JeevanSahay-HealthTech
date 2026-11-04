import { Prisma } from "@prisma/client";
import { z } from "zod";
import { withBedInventoryTransaction } from "@/lib/hospital/bed-inventory-transaction";
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
class BedConflictError extends Error {}
class BedCannotDeleteError extends Error {}

function isDatabaseConflict(error: unknown) {
  return (error instanceof Prisma.PrismaClientKnownRequestError && ["P1008", "P2025", "P2028", "P2034"].includes(error.code))
    || (error instanceof Error && /write conflict|deadlock/i.test(error.message));
}

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
    try {
      await tx.bedInventory.create({ data: { hospitalId, category, total: totalDelta, available: availableDelta } });
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") throw new InventoryConflictError();
      throw error;
    }
    return;
  }

  const total = current.total + totalDelta;
  const available = current.available + availableDelta;
  if (total < 0 || available < 0 || available > total) throw new InventoryConflictError();

  const updated = await tx.bedInventory.updateMany({
    where: { id: current.id, total: current.total, available: current.available },
    data: { total, available },
  });
  if (updated.count !== 1) throw new InventoryConflictError();
}

export const PATCH = withHospitalApi(async (req, { hospital, session }) => {
  const code = hospitalResourceId(req, "beds").toUpperCase();
  if (!code) return fail(400, "Bed ID is required.");
  const parsed = await parseBody(req, patchSchema);
  if (parsed.error) return parsed.error;

  let updated;
  try {
    updated = await withBedInventoryTransaction(async (tx) => {
      const existing = await tx.hospitalBed.findFirst({ where: { hospitalId: hospital.id, code } });
      if (!existing) return null;

      const departmentName = parsed.data.department;
      if (departmentName) {
        const department = await tx.hospitalDepartment.findFirst({
          where: { hospitalId: hospital.id, name: { equals: departmentName }, status: "ACTIVE" },
          select: { id: true },
        });
        if (!department) throw new Error("INVALID_HOSPITAL_DEPARTMENT");
      }

      const category = parsed.data.bedType ?? existing.category;
      const status = parsed.data.status ?? existing.status;
      const department = departmentName === undefined ? existing.department : departmentName || null;
      if (category !== existing.category) {
        await adjustInventory(tx, hospital.id, existing.category, -1, existing.status === "AVAILABLE" ? -1 : 0);
        await adjustInventory(tx, hospital.id, category, 1, status === "AVAILABLE" ? 1 : 0);
      } else if (status !== existing.status) {
        await adjustInventory(tx, hospital.id, category, 0, (status === "AVAILABLE" ? 1 : 0) - (existing.status === "AVAILABLE" ? 1 : 0));
      }

      const result = await tx.hospitalBed.updateMany({
        where: {
          id: existing.id,
          hospitalId: hospital.id,
          code: existing.code,
          ward: existing.ward,
          category: existing.category,
          department: existing.department,
          status: existing.status,
        },
        data: { ward: parsed.data.ward ?? existing.ward, category, department, status },
      });
      if (result.count !== 1) throw new BedConflictError();
      await tx.hospital.update({ where: { id: hospital.id }, data: { lastAvailabilityUpdate: new Date() } });
      return tx.hospitalBed.findUniqueOrThrow({ where: { id: existing.id } });
    });
  } catch (error) {
    if (error instanceof InventoryConflictError) return fail(409, "Bed totals changed while saving. Refresh hospital inventory and try again.");
    if (error instanceof BedConflictError || isDatabaseConflict(error)) return fail(409, "This bed changed while you were editing it. Refresh and try again.");
    if (error instanceof Error && error.message === "INVALID_HOSPITAL_DEPARTMENT") return fail(422, "Choose an active department from your hospital.");
    throw error;
  }
  if (!updated) return fail(404, "Bed not found in your hospital.");

  await auditHospitalChange({ session, hospital }, "BED_UPDATED", "HospitalBed", updated.id, { code, category: updated.category, status: updated.status });
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

  let deleted;
  try {
    deleted = await withBedInventoryTransaction(async (tx) => {
      const existing = await tx.hospitalBed.findFirst({ where: { hospitalId: hospital.id, code } });
      if (!existing) return null;
      if (["OCCUPIED", "RESERVED"].includes(existing.status)) throw new BedCannotDeleteError();

      await adjustInventory(tx, hospital.id, existing.category, -1, existing.status === "AVAILABLE" ? -1 : 0);
      const result = await tx.hospitalBed.deleteMany({
        where: {
          id: existing.id,
          hospitalId: hospital.id,
          code: existing.code,
          ward: existing.ward,
          category: existing.category,
          department: existing.department,
          status: existing.status,
        },
      });
      if (result.count !== 1) throw new BedConflictError();
      await tx.hospital.update({ where: { id: hospital.id }, data: { lastAvailabilityUpdate: new Date() } });
      return existing;
    });
  } catch (error) {
    if (error instanceof BedCannotDeleteError) return fail(409, "Occupied or reserved beds cannot be removed. Update their status first.");
    if (error instanceof InventoryConflictError) return fail(409, "Bed totals changed while deleting. Refresh hospital inventory and try again.");
    if (error instanceof BedConflictError || isDatabaseConflict(error)) return fail(409, "This bed changed while you were deleting it. Refresh and try again.");
    throw error;
  }
  if (!deleted) return fail(404, "Bed not found in your hospital.");

  await auditHospitalChange({ session, hospital }, "BED_DELETED", "HospitalBed", deleted.id, { code });
  try {
    await notifySavedHospitalUsers(hospital.id, { title: "Bed availability updated", body: "A hospital you follow has updated its bed records.", link: `/hospitals/${hospital.id}` });
  } catch (error) {
    console.error("[hospital] saved-hospital notification fan-out failed", error);
  }
  return ok({ deleted: true });
}, { limit: 30, windowMs: 60_000, keyPrefix: "hospital-bed-delete" });
