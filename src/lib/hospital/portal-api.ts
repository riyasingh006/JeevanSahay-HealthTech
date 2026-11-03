import "server-only";
import { AuthError, getClientIp, requireRole, writeAudit } from "@/lib/auth";
import { withApi } from "@/lib/api-helpers";
import { prisma } from "@/lib/prisma";

export type HospitalContext = {
  session: Awaited<ReturnType<typeof requireRole>>;
  hospital: NonNullable<Awaited<ReturnType<typeof prisma.hospital.findUnique>>>;
};

export async function requireVerifiedHospital(): Promise<HospitalContext> {
  const session = await requireRole("HOSPITAL_ADMIN");
  if (!session.hospitalId) {
    throw new AuthError(403, "This account is not linked to a verified hospital.");
  }
  const hospital = await prisma.hospital.findFirst({
    where: { id: session.hospitalId, status: "VERIFIED" },
  });
  if (!hospital) {
    throw new AuthError(403, "This hospital is not currently verified.");
  }
  return { session, hospital };
}

export function withHospitalApi(
  handler: (req: Request, context: HospitalContext) => Promise<Response>,
  options?: { limit?: number; windowMs?: number; keyPrefix?: string }
) {
  return withApi(async (req) => handler(req, await requireVerifiedHospital()), options);
}

export function hospitalResourceId(req: Request, resource: string): string {
  const segments = new URL(req.url).pathname.split("/").filter(Boolean);
  const index = segments.indexOf(resource);
  return index < 0 ? "" : decodeURIComponent(segments[index + 1] ?? "");
}

export function serviceKey(value: string): string {
  return value.toUpperCase().replace(/[^A-Z0-9]+/g, "_").replace(/^_+|_+$/g, "").slice(0, 40);
}

export async function auditHospitalChange(
  context: HospitalContext,
  action: string,
  entityType: string,
  entityId: string,
  meta?: Record<string, unknown>
) {
  await writeAudit({
    actorUserId: context.session.sub,
    actorEmail: context.session.email,
    action: `HOSPITAL_${action}`,
    entityType,
    entityId,
    meta: { hospitalId: context.hospital.id, ...meta },
    ip: await getClientIp(),
  });
}

export async function notifyHospitalAdmins(
  hospitalId: string,
  notification: { title: string; body: string; type?: string; link?: string }
) {
  const admins = await prisma.user.findMany({
    where: { hospitalId, role: "HOSPITAL_ADMIN", status: "ACTIVE" },
    select: { id: true },
  });
  if (admins.length === 0) return;
  await prisma.notification.createMany({
    data: admins.map((admin) => ({
      userId: admin.id,
      title: notification.title,
      body: notification.body,
      type: notification.type ?? "INFO",
      link: notification.link,
    })),
  });
}

export async function notifySavedHospitalUsers(
  hospitalId: string,
  notification: { title: string; body: string; type?: string; link?: string }
) {
  const saved = await prisma.savedHospital.findMany({
    where: { hospitalId },
    select: { userId: true },
    take: 1000,
  });
  if (saved.length === 0) return;
  await prisma.notification.createMany({
    data: saved.map((entry) => ({
      userId: entry.userId,
      title: notification.title,
      body: notification.body,
      type: notification.type ?? "INFO",
      link: notification.link,
    })),
  });
}
