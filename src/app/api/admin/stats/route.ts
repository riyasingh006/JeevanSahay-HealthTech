import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/auth";
import { ok, withApi } from "@/lib/api-helpers";

export const GET = withApi(async () => {
  await requireRole("SUPER_ADMIN");
  const since = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
  const [registeredUsers, verifiedHospitals, pendingApplications, pendingApplicationsCount, pendingHospitals, pendingHospitalsCount, beds, activeSpecialists, emergencySearches, openReports, auditTrail] = await Promise.all([
    prisma.user.count(),
    prisma.hospital.count({ where: { status: "VERIFIED" } }),
    prisma.hospitalApplication.findMany({
      where: { status: "PENDING_VERIFICATION" },
      select: { id: true, hospitalName: true, city: true, hospitalType: true, status: true, createdAt: true, user: { select: { email: true, emailVerifiedAt: true } } },
      orderBy: { createdAt: "desc" },
      take: 20,
    }),
    prisma.hospitalApplication.count({ where: { status: "PENDING_VERIFICATION" } }),
    prisma.hospital.findMany({
      where: { status: "PENDING_VERIFICATION" },
      select: { id: true, name: true, city: true, type: true, status: true, createdAt: true },
      orderBy: { createdAt: "desc" },
      take: 20,
    }),
    prisma.hospital.count({ where: { status: "PENDING_VERIFICATION" } }),
    prisma.bedInventory.aggregate({
      where: { hospital: { status: "VERIFIED" } },
      _sum: { total: true, available: true },
    }),
    prisma.doctor.count({ where: { availability: "AVAILABLE", hospital: { status: "VERIFIED" } } }),
    prisma.searchRecord.count({ where: { mode: "EMERGENCY", createdAt: { gte: since } } }),
    prisma.report.count({ where: { status: { in: ["OPEN", "IN_REVIEW"] } } }),
    prisma.auditLog.findMany({
      orderBy: { createdAt: "desc" },
      take: 12,
      select: { id: true, actorEmail: true, action: true, entityType: true, entityId: true, ip: true, createdAt: true, actor: { select: { name: true } } },
    }),
  ]);

  const queue = [
    ...pendingApplications.map((application) => ({
      id: application.id,
      applicationId: application.id,
      type: "APPLICATION" as const,
      name: application.hospitalName,
      city: application.city,
      hospitalType: application.hospitalType,
      status: application.status,
      email: application.user.email,
      emailVerified: Boolean(application.user.emailVerifiedAt),
      createdAt: application.createdAt,
    })),
    ...pendingHospitals.map((hospital) => ({
      id: hospital.id,
      hospitalId: hospital.id,
      type: "HOSPITAL" as const,
      name: hospital.name,
      city: hospital.city,
      hospitalType: hospital.type,
      status: hospital.status,
      email: "",
      emailVerified: true,
      createdAt: hospital.createdAt,
    })),
  ].sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime()).slice(0, 20);

  return ok({
    stats: {
      registeredUsers,
      verifiedHospitals,
      pendingHospitals: pendingApplicationsCount + pendingHospitalsCount,
      totalBeds: beds._sum.total ?? 0,
      availableBeds: beds._sum.available ?? 0,
      activeSpecialists,
      emergencySearches,
      emergencySearchDays: 7,
      openReports,
    },
    queue,
    auditTrail,
  });
});
