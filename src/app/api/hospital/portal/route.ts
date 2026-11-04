import { prisma } from "@/lib/prisma";
import { withHospitalApi } from "@/lib/hospital/portal-api";
import type { HospitalSettingsRecord } from "@/lib/hospital/hospital-data";

function dateInIndia(value: Date): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Kolkata",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(value);
}

function shiftDateKey(value: string, days: number): string {
  const date = new Date(`${value}T12:00:00.000Z`);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

export const GET = withHospitalApi(async (_req, { session, hospital }) => {
  const [beds, bedInventory, doctors, departments, services, appointments, emergencyCases, notifications, savedSettings, admins] = await Promise.all([
    prisma.hospitalBed.findMany({ where: { hospitalId: hospital.id }, orderBy: [{ category: "asc" }, { code: "asc" }] }),
    prisma.bedInventory.findMany({ where: { hospitalId: hospital.id }, orderBy: { category: "asc" } }),
    prisma.doctor.findMany({ where: { hospitalId: hospital.id }, orderBy: { name: "asc" } }),
    prisma.hospitalDepartment.findMany({ where: { hospitalId: hospital.id }, orderBy: { name: "asc" } }),
    prisma.service.findMany({ where: { hospitalId: hospital.id }, orderBy: { key: "asc" } }),
    prisma.appointment.findMany({
      where: { hospitalId: hospital.id },
      include: { doctor: { select: { id: true, name: true, department: true } } },
      orderBy: { scheduledAt: "desc" },
      take: 200,
    }),
    prisma.emergencyCase.findMany({ where: { hospitalId: hospital.id }, orderBy: { reportedAt: "desc" }, take: 200 }),
    prisma.notification.findMany({ where: { userId: session.sub }, orderBy: { createdAt: "desc" }, take: 100 }),
    prisma.hospitalSettings.findUnique({ where: { hospitalId: hospital.id } }),
    prisma.user.findMany({ where: { hospitalId: hospital.id, role: "HOSPITAL_ADMIN", status: "ACTIVE" }, select: { id: true } }),
  ]);

  const auditLogs = await prisma.auditLog.findMany({
    where: { actorUserId: { in: admins.map((admin) => admin.id) }, action: { startsWith: "HOSPITAL_" } },
    orderBy: { createdAt: "desc" },
    take: 10,
  });

  const rangeStart = new Date(Date.now() - 30 * 24 * 60 * 60_000);
  const [trendAppointments, trendEmergencies] = await Promise.all([
    prisma.appointment.findMany({ where: { hospitalId: hospital.id, createdAt: { gte: rangeStart } }, select: { createdAt: true } }),
    prisma.emergencyCase.findMany({ where: { hospitalId: hospital.id, reportedAt: { gte: rangeStart } }, select: { reportedAt: true } }),
  ]);

  const defaultSettings: HospitalSettingsRecord = {
    notifications: { emergencyAlerts: true, appointmentReminders: true, bedCapacityAlerts: true, dailySummary: false, email: false, sms: false },
    display: { landingPage: "overview", density: "comfortable", showLiveBadges: false, autoRefresh: false },
    preferences: { timezone: "Asia/Kolkata", dateFormat: "DD MMM YYYY", language: "English", weekStart: "Monday" },
  };
  let settings = defaultSettings;
  if (savedSettings) {
    try {
      const stored = JSON.parse(savedSettings.configJson) as Partial<HospitalSettingsRecord>;
      settings = {
        notifications: { ...defaultSettings.notifications, ...stored.notifications },
        display: { ...defaultSettings.display, ...stored.display },
        preferences: { ...defaultSettings.preferences, ...stored.preferences },
      };
    } catch {
      settings = defaultSettings;
    }
  }

  const appointmentRows = appointments.map((appointment) => ({
    id: appointment.id,
    reference: appointment.id.slice(-8).toUpperCase(),
    patientRef: appointment.patientName,
    doctorId: appointment.doctorId ?? "",
    doctorName: appointment.doctor?.name ?? "General appointment",
    department: appointment.doctor?.department ?? "General",
    date: dateInIndia(appointment.scheduledAt),
    time: appointment.scheduledAt.toLocaleTimeString("en-IN", { timeZone: "Asia/Kolkata", hour: "numeric", minute: "2-digit", hour12: true }),
    status: appointment.status,
    type: "Patient request",
    patientEmail: appointment.patientEmail,
    patientPhone: appointment.patientPhone,
    hospitalNote: appointment.hospitalNote,
  }));

  const startKey = shiftDateKey(dateInIndia(new Date()), -29);
  const trend = Array.from({ length: 30 }, (_, index) => {
    const key = shiftDateKey(startKey, index);
    return {
      date: key,
      emergency: trendEmergencies.filter((item) => dateInIndia(item.reportedAt) === key).length,
      appointments: trendAppointments.filter((item) => dateInIndia(item.createdAt) === key).length,
    };
  });

  return new Response(JSON.stringify({
    ok: true,
    data: {
      hospital: {
        id: hospital.id,
        name: hospital.name,
        type: hospital.type,
        registrationNumber: hospital.registrationNumber ?? "",
        addressLine: hospital.addressLine,
        city: hospital.city,
        state: hospital.state,
        pincode: hospital.pincode,
        phone: hospital.phone,
        emergencyPhone: hospital.emergencyPhone ?? "",
        email: hospital.email ?? "",
        website: hospital.website ?? "",
        accreditation: hospital.accreditation ?? "",
        established: hospital.established ?? new Date().getFullYear(),
        about: hospital.about ?? "",
      },
      beds: beds.map((bed) => ({ id: bed.code, ward: bed.ward, bedType: bed.category, department: bed.department ?? "Unassigned", status: bed.status, updatedAt: bed.updatedAt.toISOString() })),
      bedInventory,
      doctors: doctors.map((doctor) => ({ id: doctor.id, name: doctor.name, specialty: doctor.specialty, department: doctor.department ?? "", qualification: doctor.qualification ?? "", experienceYears: doctor.experienceYears, availability: doctor.availability, shift: doctor.timings ?? "", phone: doctor.phone ?? "", email: doctor.email ?? "" })),
      departments: departments.map((department) => ({ id: department.id, name: department.name, head: department.head, status: department.status, location: department.location ?? "", description: department.description ?? "" })),
      services: services.map((service) => ({ id: service.id, name: service.name ?? service.key.replaceAll("_", " "), department: service.department ?? "", status: service.status, hours: service.hours ?? "", description: service.details ?? "" })),
      appointments: appointmentRows,
      emergencyCases: emergencyCases.map((caseItem) => ({ id: caseItem.id, reference: caseItem.reference, patientRef: caseItem.patientRef, age: caseItem.age, condition: caseItem.condition, severity: caseItem.severity, status: caseItem.status, department: caseItem.department ?? "", location: caseItem.location ?? "", reportedAt: caseItem.reportedAt.toISOString() })),
      profile: {
        name: hospital.name,
        type: hospital.type,
        registrationNumber: hospital.registrationNumber ?? "",
        addressLine: hospital.addressLine,
        city: hospital.city,
        state: hospital.state,
        pincode: hospital.pincode,
        phone: hospital.phone,
        emergencyPhone: hospital.emergencyPhone ?? "",
        email: hospital.email ?? "",
        website: hospital.website ?? "",
        accreditation: hospital.accreditation ?? "",
        established: hospital.established ?? new Date().getFullYear(),
        about: hospital.about ?? "",
      },
      settings,
      notifications: notifications.map((notification) => ({ id: notification.id, title: notification.title, body: notification.body, tone: notification.type.toLowerCase(), createdAt: notification.createdAt.toISOString(), read: notification.read, href: notification.link ?? "/hospital/notifications" })),
      activity: auditLogs.map((entry) => ({ id: entry.id, message: entry.action.replace(/^HOSPITAL_/, "").replaceAll("_", " ").toLowerCase(), detail: entry.entityType ?? "Hospital record", at: entry.createdAt.toISOString(), tone: "blue" })),
      trend,
    },
  }), { headers: { "content-type": "application/json" } });
}, { limit: 60, windowMs: 60_000, keyPrefix: "hospital-portal" });
