import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { safeErrorMetadata } from "@/lib/database-errors";
import { auditHospitalChange, withHospitalApi } from "@/lib/hospital/portal-api";
import { fail, ok, parseBody } from "@/lib/api-helpers";
import { isEmailDeliveryConfigured, sendPortalNoticeEmail } from "@/lib/email";

const updateSchema = z.object({
  appointmentId: z.string().min(1).max(64),
  status: z.enum(["CONFIRMED", "DECLINED", "CANCELLED", "COMPLETED", "NO_SHOW"]),
  note: z.string().trim().max(500).optional().default(""),
});

const transitions: Record<string, string[]> = {
  REQUESTED: ["CONFIRMED", "DECLINED"],
  CONFIRMED: ["CANCELLED", "COMPLETED", "NO_SHOW"],
};

export const GET = withHospitalApi(async (_req, { hospital }) => {
  const appointments = await prisma.appointment.findMany({
    where: { hospitalId: hospital.id },
    include: {
      doctor: { select: { id: true, name: true, department: true } },
      patient: { select: { id: true, name: true } },
    },
    orderBy: [{ scheduledAt: "asc" }, { createdAt: "desc" }],
    take: 200,
  });
  return ok({ appointments });
});

export const PATCH = withHospitalApi(async (req, context) => {
  const parsed = await parseBody(req, updateSchema);
  if (parsed.error) return parsed.error;
  const appointment = await prisma.appointment.findFirst({
    where: { id: parsed.data.appointmentId, hospitalId: context.hospital.id },
  });
  if (!appointment) return fail(404, "Appointment not found in your hospital.");
  if (!transitions[appointment.status]?.includes(parsed.data.status)) {
    return fail(409, "This appointment status cannot be changed to the selected value.");
  }
  if (["COMPLETED", "NO_SHOW"].includes(parsed.data.status) && appointment.scheduledAt > new Date()) {
    return fail(409, "A future appointment cannot be completed or marked as a no-show.");
  }

  const now = new Date();
  const result = await prisma.$transaction(async (tx) => {
    const updated = await tx.appointment.updateMany({
      where: { id: appointment.id, hospitalId: context.hospital.id, status: appointment.status },
      data: {
        status: parsed.data.status,
        hospitalNote: parsed.data.note || null,
        respondedAt: now,
      },
    });
    if (updated.count !== 1) return false;
    const titleByStatus: Record<string, string> = {
      CONFIRMED: "Appointment confirmed",
      DECLINED: "Appointment request declined",
      CANCELLED: "Appointment cancelled by the hospital",
      COMPLETED: "Appointment marked complete",
      NO_SHOW: "Appointment marked as not attended",
    };
    const title = titleByStatus[parsed.data.status];
    const detail = parsed.data.note || `${context.hospital.name} updated your appointment request.`;
    await tx.notification.create({
      data: {
        userId: appointment.patientId,
        title,
        body: detail,
        type: parsed.data.status === "CONFIRMED" ? "SUCCESS" : "WARNING",
        link: "/dashboard/appointments",
      },
    });
    return true;
  });
  if (!result) return fail(409, "This appointment was updated elsewhere. Refresh and try again.");

  await auditHospitalChange(context, "APPOINTMENT_UPDATED", "Appointment", appointment.id, {
    status: parsed.data.status,
  });
  let emailDelivery: "sent" | "not_configured" | "failed" = "not_configured";
  if (appointment.patientEmail && isEmailDeliveryConfigured()) {
    try {
      const statusLabels: Record<string, string> = {
        CONFIRMED: "confirmed",
        DECLINED: "declined",
        CANCELLED: "cancelled by the hospital",
        COMPLETED: "marked complete",
        NO_SHOW: "marked as not attended",
      };
      await sendPortalNoticeEmail({
        to: appointment.patientEmail,
        name: appointment.patientName,
        subject: `Appointment ${statusLabels[parsed.data.status]} — Jeevan Sahay`,
        paragraphs: [
          `${context.hospital.name} has ${statusLabels[parsed.data.status]} your appointment request.`,
          ...(parsed.data.note ? [`Hospital note: ${parsed.data.note}`] : []),
        ],
        actionPath: "/dashboard/appointments",
        actionLabel: "View your appointments",
      });
      emailDelivery = "sent";
    } catch (error) {
      emailDelivery = "failed";
      console.error("[hospital-appointments] patient email notification failed", safeErrorMetadata(error));
    }
  }
  return ok({ updated: true, status: parsed.data.status, emailDelivery });
}, { limit: 60, windowMs: 60_000, keyPrefix: "hospital-appointments" });
