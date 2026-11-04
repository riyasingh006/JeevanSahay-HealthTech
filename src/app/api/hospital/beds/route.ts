import { z } from "zod";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { withBedInventoryTransaction } from "@/lib/hospital/bed-inventory-transaction";
import { auditHospitalChange, notifySavedHospitalUsers, withHospitalApi } from "@/lib/hospital/portal-api";
import { fail, ok, parseBody } from "@/lib/api-helpers";

const bedSchema = z.object({
  id: z.string().trim().min(2).max(40).regex(/^[a-zA-Z0-9-]+$/),
  ward: z.string().trim().min(2).max(80),
  bedType: z.enum(["GENERAL", "ICU", "EMERGENCY", "PRIVATE", "PEDIATRIC", "MATERNITY", "ISOLATION", "VENTILATOR"]),
  department: z.string().trim().max(80).optional().default(""),
  status: z.enum(["AVAILABLE", "OCCUPIED", "RESERVED", "MAINTENANCE"]),
});

export const GET = withHospitalApi(async (_req, { hospital }) => {
  const [beds, inventory] = await Promise.all([
    prisma.hospitalBed.findMany({ where: { hospitalId: hospital.id }, orderBy: [{ category: "asc" }, { code: "asc" }] }),
    prisma.bedInventory.findMany({ where: { hospitalId: hospital.id }, orderBy: { category: "asc" } }),
  ]);
  return ok({ beds, inventory });
});

export const POST = withHospitalApi(async (req, { hospital, session }) => {
  const parsed = await parseBody(req, bedSchema);
  if (parsed.error) return parsed.error;
  if (parsed.data.department) {
    const department = await prisma.hospitalDepartment.findFirst({
      where: { hospitalId: hospital.id, name: { equals: parsed.data.department } },
      select: { id: true },
    });
    if (!department) return fail(422, "Choose a department from this hospital or leave it unassigned.");
  }

  try {
    const bed = await withBedInventoryTransaction(async (tx) => {
      const created = await tx.hospitalBed.create({
        data: {
          hospitalId: hospital.id,
          code: parsed.data.id.toUpperCase(),
          ward: parsed.data.ward,
          category: parsed.data.bedType,
          department: parsed.data.department || null,
          status: parsed.data.status,
        },
      });
      await tx.bedInventory.upsert({
        where: { hospitalId_category: { hospitalId: hospital.id, category: parsed.data.bedType } },
        create: { hospitalId: hospital.id, category: parsed.data.bedType, total: 1, available: parsed.data.status === "AVAILABLE" ? 1 : 0 },
        update: { total: { increment: 1 }, available: { increment: parsed.data.status === "AVAILABLE" ? 1 : 0 } },
      });
      await tx.hospital.update({ where: { id: hospital.id }, data: { lastAvailabilityUpdate: new Date() } });
      return created;
    });
    await auditHospitalChange({ session, hospital }, "BED_CREATED", "HospitalBed", bed.id, { code: bed.code, category: bed.category, status: bed.status });
    try {
      await notifySavedHospitalUsers(hospital.id, { title: "Bed availability updated", body: "A hospital you follow has updated its bed records.", link: `/hospitals/${hospital.id}` });
    } catch (error) {
      console.error("[hospital] saved-hospital notification fan-out failed", error);
    }
    return ok({ bed }, { status: 201 });
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      return fail(409, "A bed with this ID or bed inventory changed while saving. Refresh and try again.");
    }
    if ((error instanceof Prisma.PrismaClientKnownRequestError && ["P1008", "P2028", "P2034"].includes(error.code)) || (error instanceof Error && /write conflict|deadlock/i.test(error.message))) {
      return fail(409, "Bed inventory changed while saving. Refresh the page and try again.");
    }
    throw error;
  }
}, { limit: 30, windowMs: 60_000, keyPrefix: "hospital-beds" });
