import { Prisma } from "@prisma/client";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { safeErrorMetadata } from "@/lib/database-errors";

import { withBedInventoryTransaction } from "@/lib/hospital/bed-inventory-transaction";
import { getClientIp, requireRole, writeAudit } from "@/lib/auth";
import { fail, idFromUrl, ok, parseBody, withApi } from "@/lib/api-helpers";

const schema = z.object({
  beds: z
    .array(
      z.object({
        category: z.enum([
          "GENERAL",
          "ICU",
          "EMERGENCY",
          "VENTILATOR",
          "PEDIATRIC",
          "MATERNITY",
          "ISOLATION",
          "PRIVATE",
        ]),
        total: z.coerce.number().int().min(0).max(2000),
        available: z.coerce.number().int().min(0).max(2000),
      })
    )
    .min(1)
    .max(10)
    .refine((beds) => new Set(beds.map((bed) => bed.category)).size === beds.length, {
      message: "Each bed category can be updated only once per request.",
    }),
});

class BedInventoryConflictError extends Error {}

function isDatabaseConflict(error: unknown) {
  return (
    (error instanceof Prisma.PrismaClientKnownRequestError && ["P1008", "P2002", "P2025", "P2028", "P2034"].includes(error.code)) ||
    (error instanceof Error && /write conflict|deadlock/i.test(error.message))
  );
}

async function assertHospitalAccess(
  sessionHospitalId: string | undefined,
  role: string,
  hospitalId: string
) {
  if (role === "SUPER_ADMIN") return true;
  return role === "HOSPITAL_ADMIN" && sessionHospitalId === hospitalId;
}

export const PATCH = withApi(
  async (req) => {
    const session = await requireRole("HOSPITAL_ADMIN", "SUPER_ADMIN");
    const hospitalId = idFromUrl(req);
    if (!hospitalId) return fail(400, "Hospital id is required.");
    if (!(await assertHospitalAccess(session.hospitalId, session.role, hospitalId))) {
      return fail(403, "You can only manage your own facility.");
    }

    const parsed = await parseBody(req, schema);
    if (parsed.error) return parsed.error;
    for (const bed of parsed.data.beds) {
      if (bed.available > bed.total) {
        return fail(422, `${bed.category}: available beds cannot exceed total beds.`);
      }
    }

    let updatedHospital: { lastAvailabilityUpdate: Date } | null = null;
    try {
      const result = await withBedInventoryTransaction(async (tx) => {
        const hospital = await tx.hospital.findUnique({ where: { id: hospitalId }, select: { id: true } });
        if (!hospital) return null;

        const itemizedBed = await tx.hospitalBed.findFirst({
          where: { hospitalId, category: { in: parsed.data.beds.map((bed) => bed.category) } },
          select: { id: true },
        });
        if (itemizedBed) return { conflict: "itemized" as const };

        for (const bed of parsed.data.beds) {
          const existing = await tx.bedInventory.findUnique({
            where: { hospitalId_category: { hospitalId, category: bed.category } },
          });
          if (!existing) {
            try {
              await tx.bedInventory.create({ data: { ...bed, hospitalId } });
            } catch (error) {
              if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
                throw new BedInventoryConflictError();
              }
              throw error;
            }
            continue;
          }

          const updated = await tx.bedInventory.updateMany({
            where: { id: existing.id, total: existing.total, available: existing.available },
            data: { total: bed.total, available: bed.available },
          });
          if (updated.count !== 1) throw new BedInventoryConflictError();
        }

        const changedHospital = await tx.hospital.update({
          where: { id: hospitalId },
          data: { lastAvailabilityUpdate: new Date() },
          select: { lastAvailabilityUpdate: true },
        });
        return { conflict: null, changedHospital };
      });

      if (!result) return fail(404, "Hospital not found.");
      if (result.conflict === "itemized") {
        return fail(409, "This hospital tracks individual beds in the portal. Update those beds there to keep totals consistent.");
      }
      updatedHospital = result.changedHospital;
    } catch (error) {
      if (error instanceof BedInventoryConflictError || isDatabaseConflict(error)) {
        return fail(409, "Bed inventory changed while saving. Refresh and try again.");
      }
      throw error;
    }

    await writeAudit({
      actorUserId: session.sub,
      actorEmail: session.email,
      action: "BED_AVAILABILITY_UPDATE",
      entityType: "Hospital",
      entityId: hospitalId,
      meta: parsed.data,
      ip: await getClientIp(),
    });

    try {
      const watchers = await prisma.savedHospital.findMany({
        where: { hospitalId },
        select: { userId: true },
        take: 50,
      });
      for (const watcher of watchers) {
        await prisma.notification.create({
          data: {
            userId: watcher.userId,
            title: "Bed availability updated",
            body: "A hospital you follow has published fresh availability information.",
            type: "INFO",
            link: `/hospitals/${hospitalId}`,
          },
        });
      }
    } catch (error) {
      console.error("[beds] notification fan-out failed", safeErrorMetadata(error));
    }

    return ok({ lastAvailabilityUpdate: updatedHospital.lastAvailabilityUpdate });
  },
  { limit: 30, windowMs: 60_000, keyPrefix: "beds" }
);
