import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { getClientIp, requireRole, writeAudit } from "@/lib/auth";
import { fail, ok, parseBody, withApi } from "@/lib/api-helpers";
import { notifyHospitalAdmins } from "@/lib/hospital/portal-api";

const requestSchema = z.object({
  hospitalId: z.string().min(1).max(64),
  doctorId: z.string().min(1).max(64).optional(),
  patientName: z.string().trim().min(2).max(80),
  patientPhone: z.string().trim().regex(/^[+0-9 ()-]{6,24}$/),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  time: z.string().regex(/^(0?[1-9]|1[0-2]):[0-5]\d (AM|PM)$/),
});

const cancelSchema = z.object({ appointmentId: z.string().min(1).max(64) });

function parseIndiaDateTime(date: string, time: string): Date | null {
  const [year, month, day] = date.split("-").map(Number);
  const dateCheck = new Date(Date.UTC(year, month - 1, day));
  if (
    dateCheck.getUTCFullYear() !== year ||
    dateCheck.getUTCMonth() !== month - 1 ||
    dateCheck.getUTCDate() !== day
  ) return null;

  const match = /^(0?[1-9]|1[0-2]):([0-5]\d) (AM|PM)$/.exec(time);
  if (!match) return null;
  const hour12 = Number(match[1]);
  const minute = Number(match[2]);
  const hour = (hour12 % 12) + (match[3] === "PM" ? 12 : 0);
  return new Date(Date.UTC(year, month - 1, day, hour, minute) - 330 * 60_000);
}

export const GET = withApi(async () => {
  const session = await requireRole("PATIENT");
  const appointments = await prisma.appointment.findMany({
    where: { patientId: session.sub },
    include: {
      hospital: { select: { id: true, name: true, city: true, phone: true } },
      doctor: { select: { id: true, name: true, specialty: true } },
    },
    orderBy: { createdAt: "desc" },
    take: 100,
  });
  return ok({ appointments });
});

export const POST = withApi(
  async (req) => {
    const session = await requireRole("PATIENT");
    const parsed = await parseBody(req, requestSchema);
    if (parsed.error) return parsed.error;
    const data = parsed.data;
    const scheduledAt = parseIndiaDateTime(data.date, data.time);
    if (!scheduledAt || scheduledAt <= new Date()) {
      return fail(422, "Choose a valid future date and time.");
    }

    const hospital = await prisma.hospital.findFirst({
      where: { id: data.hospitalId, status: "VERIFIED" },
      select: { id: true },
    });
    if (!hospital) return fail(404, "Verified hospital not found.");

    if (data.doctorId) {
      const doctor = await prisma.doctor.findFirst({
        where: {
          id: data.doctorId,
          hospitalId: hospital.id,
          availability: { not: "UNAVAILABLE" },
        },
        select: { id: true },
      });
      if (!doctor) return fail(404, "Available doctor not found at this hospital.");
    }

    const appointment = await prisma.appointment.create({
      data: {
        patientId: session.sub,
        patientName: data.patientName,
        patientEmail: session.email,
        patientPhone: data.patientPhone,
        hospitalId: hospital.id,
        doctorId: data.doctorId,
        scheduledAt,
        status: "REQUESTED",
      },
      select: { id: true, status: true, scheduledAt: true, createdAt: true },
    });
    await writeAudit({
      actorUserId: session.sub,
      actorEmail: session.email,
      action: "APPOINTMENT_REQUESTED",
      entityType: "Appointment",
      entityId: appointment.id,
      meta: { hospitalId: hospital.id, doctorId: data.doctorId ?? null },
      ip: await getClientIp(),
    });
    try {
      await notifyHospitalAdmins(hospital.id, {
        title: "New appointment request",
        body: "A patient submitted an appointment request.",
        type: "INFO",
        link: "/hospital/appointments",
      });
    } catch (error) {
      console.error("[appointments] hospital notification fan-out failed", error);
    }
    return ok({ appointment }, { status: 201 });
  },
  { limit: 10, windowMs: 60_000, keyPrefix: "appointment-create" }
);

export const PATCH = withApi(
  async (req) => {
    const session = await requireRole("PATIENT");
    const parsed = await parseBody(req, cancelSchema);
    if (parsed.error) return parsed.error;
    const now = new Date();
    const updated = await prisma.appointment.updateMany({
      where: {
        id: parsed.data.appointmentId,
        patientId: session.sub,
        status: { in: ["REQUESTED", "CONFIRMED"] },
        scheduledAt: { gt: now },
      },
      data: { status: "CANCELLED" },
    });
    if (updated.count !== 1) {
      return fail(409, "This appointment cannot be cancelled. Refresh the page and try again.");
    }
    await writeAudit({
      actorUserId: session.sub,
      actorEmail: session.email,
      action: "APPOINTMENT_CANCELLED",
      entityType: "Appointment",
      entityId: parsed.data.appointmentId,
      ip: await getClientIp(),
    });
    return ok({ cancelled: true });
  },
  { limit: 20, windowMs: 60_000, keyPrefix: "appointment-cancel" }
);
