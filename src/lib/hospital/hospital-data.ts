export type BedType = "GENERAL" | "ICU" | "EMERGENCY" | "PRIVATE" | "PEDIATRIC" | "MATERNITY" | "ISOLATION" | "VENTILATOR";
export type BedStatus = "AVAILABLE" | "OCCUPIED" | "RESERVED" | "MAINTENANCE";
export type DoctorAvailability = "AVAILABLE" | "LIMITED" | "UNAVAILABLE";
export type DepartmentStatus = "ACTIVE" | "LIMITED" | "INACTIVE";
export type EmergencySeverity = "CRITICAL" | "URGENT" | "MODERATE";
export type EmergencyStatus = "RECEIVED" | "IN_TREATMENT" | "STABILIZED" | "DISCHARGED";
export type ServiceStatus = "AVAILABLE" | "LIMITED" | "UNAVAILABLE";
export type AppointmentStatus = "REQUESTED" | "CONFIRMED" | "DECLINED" | "CANCELLED" | "COMPLETED" | "NO_SHOW";
export type NotificationTone = "info" | "success" | "warning" | "critical";

export interface BedInventoryRecord {
  category: BedType;
  total: number;
  available: number;
}

export interface BedRecord {
  id: string;
  ward: string;
  bedType: BedType;
  department: string;
  status: BedStatus;
  updatedAt: string;
}

export interface DoctorRecord {
  id: string;
  name: string;
  specialty: string;
  department: string;
  qualification: string;
  experienceYears: number;
  availability: DoctorAvailability;
  shift: string;
  phone: string;
  email: string;
}

export interface DepartmentRecord {
  id: string;
  name: string;
  head: string;
  status: DepartmentStatus;
  location: string;
  description: string;
}

export interface EmergencyCaseRecord {
  id: string;
  reference: string;
  patientRef: string;
  age: number | null;
  condition: string;
  severity: EmergencySeverity;
  status: EmergencyStatus;
  department: string;
  location: string;
  reportedAt: string;
}

export interface ServiceRecord {
  id: string;
  name: string;
  department: string;
  status: ServiceStatus;
  hours: string;
  description: string;
}

export interface AppointmentRecord {
  id: string;
  reference: string;
  patientRef: string;
  doctorId: string;
  doctorName: string;
  department: string;
  date: string;
  time: string;
  status: AppointmentStatus;
  type: string;
  patientEmail?: string;
  patientPhone?: string;
  hospitalNote?: string | null;
}

export interface HospitalProfileRecord {
  name: string;
  type: "GOVERNMENT" | "PRIVATE" | "TRUST" | "PSU";
  registrationNumber: string;
  addressLine: string;
  city: string;
  state: string;
  pincode: string;
  phone: string;
  emergencyPhone: string;
  email: string;
  website: string;
  accreditation: string;
  established: number;
  about: string;
}

export interface HospitalSettingsRecord {
  notifications: {
    emergencyAlerts: boolean;
    appointmentReminders: boolean;
    bedCapacityAlerts: boolean;
    dailySummary: boolean;
    email: boolean;
    sms: boolean;
  };
  display: {
    landingPage: "overview" | "beds" | "appointments";
    density: "comfortable" | "compact";
    showLiveBadges: boolean;
    autoRefresh: boolean;
  };
  preferences: {
    timezone: string;
    dateFormat: "DD MMM YYYY" | "MM/DD/YYYY" | "YYYY-MM-DD";
    language: "English" | "Hindi";
    weekStart: "Monday" | "Sunday";
  };
}

export interface HospitalNotification {
  id: string;
  title: string;
  body: string;
  tone: NotificationTone;
  createdAt: string;
  read: boolean;
  href: string;
}

export interface HospitalActivity {
  id: string;
  message: string;
  detail: string;
  at: string;
  tone: "blue" | "green" | "amber" | "red";
}

export interface DailyTrendPoint {
  date: string;
  emergency: number;
  appointments: number;
}

export function bedCounts(beds: BedRecord[]) {
  return beds.reduce((acc, bed) => {
    acc.total += 1;
    if (bed.status === "AVAILABLE") acc.available += 1;
    if (bed.status === "OCCUPIED") acc.occupied += 1;
    if (bed.status === "RESERVED") acc.reserved += 1;
    if (bed.status === "MAINTENANCE") acc.maintenance += 1;
    return acc;
  }, { total: 0, available: 0, occupied: 0, reserved: 0, maintenance: 0 });
}

export function bedInventoryCounts(inventory: BedInventoryRecord[], beds: BedRecord[]) {
  if (inventory.length === 0) return bedCounts(beds);
  const totals = inventory.reduce((sum, row) => ({ total: sum.total + row.total, available: sum.available + row.available }), { total: 0, available: 0 });
  const itemized = bedCounts(beds);
  return {
    ...itemized,
    total: totals.total,
    available: totals.available,
    occupied: Math.max(0, totals.total - totals.available - itemized.reserved - itemized.maintenance),
  };
}

export function bedInventoryByType(inventory: BedInventoryRecord[], beds: BedRecord[]) {
  if (inventory.length === 0) return bedsByType(beds);
  return inventory.map((row) => {
    const itemized = bedCounts(beds.filter((bed) => bed.bedType === row.category));
    return {
      bedType: row.category,
      total: row.total,
      available: row.available,
      occupied: Math.max(0, row.total - row.available - itemized.reserved - itemized.maintenance),
      reserved: itemized.reserved,
      maintenance: itemized.maintenance,
    };
  });
}

export function availableBedsByType(inventory: BedInventoryRecord[], beds: BedRecord[], bedType: BedType): number {
  const aggregate = inventory.find((row) => row.category === bedType);
  return aggregate ? aggregate.available : beds.filter((bed) => bed.bedType === bedType && bed.status === "AVAILABLE").length;
}

export function bedsByType(beds: BedRecord[]) {
  const map = new Map<BedType, { total: number; available: number; occupied: number }>();
  for (const bed of beds) {
    const entry = map.get(bed.bedType) ?? { total: 0, available: 0, occupied: 0 };
    entry.total += 1;
    if (bed.status === "AVAILABLE") entry.available += 1;
    if (bed.status === "OCCUPIED") entry.occupied += 1;
    map.set(bed.bedType, entry);
  }
  return Array.from(map.entries()).map(([bedType, counts]) => ({ bedType, ...counts }));
}

export function departmentBedSummary(beds: BedRecord[], departments: DepartmentRecord[]) {
  return departments.map((department) => {
    const counts = bedCounts(beds.filter((bed) => bed.department === department.name));
    return {
      ...department,
      totalBeds: counts.total,
      availableBeds: counts.available,
      occupiedBeds: counts.occupied,
      utilization: counts.total ? Math.round((counts.occupied / counts.total) * 100) : 0,
    };
  });
}

export function departmentDoctorCount(doctors: DoctorRecord[], departmentName: string): number {
  return doctors.filter((doctor) => doctor.department === departmentName).length;
}

export function availableIcuBeds(beds: BedRecord[]): number {
  return beds.filter((bed) => bed.bedType === "ICU" && bed.status === "AVAILABLE").length;
}

export function doctorAvailabilityCounts(doctors: DoctorRecord[]) {
  return doctors.reduce((acc, doctor) => {
    acc.total += 1;
    if (doctor.availability === "AVAILABLE") acc.available += 1;
    if (doctor.availability === "LIMITED") acc.limited += 1;
    if (doctor.availability === "UNAVAILABLE") acc.unavailable += 1;
    return acc;
  }, { total: 0, available: 0, limited: 0, unavailable: 0 });
}

export function todayAppointments(appointments: AppointmentRecord[]): AppointmentRecord[] {
  const today = new Date(Date.now() + 330 * 60_000).toISOString().slice(0, 10);
  return appointments.filter((appointment) => appointment.date === today && ["REQUESTED", "CONFIRMED"].includes(appointment.status));
}

export function appointmentStatusCounts(appointments: AppointmentRecord[]) {
  return appointments.reduce((acc, appointment) => {
    acc.total += 1;
    if (appointment.status === "REQUESTED") acc.requested += 1;
    if (appointment.status === "CONFIRMED") acc.confirmed += 1;
    if (appointment.status === "COMPLETED") acc.completed += 1;
    if (appointment.status === "DECLINED") acc.declined += 1;
    if (appointment.status === "CANCELLED") acc.cancelled += 1;
    if (appointment.status === "NO_SHOW") acc.noShow += 1;
    return acc;
  }, { total: 0, requested: 0, confirmed: 0, completed: 0, declined: 0, cancelled: 0, noShow: 0 });
}

export function serviceStatusCounts(services: ServiceRecord[]) {
  return services.reduce((acc, service) => {
    acc.total += 1;
    if (service.status === "AVAILABLE") acc.available += 1;
    if (service.status === "LIMITED") acc.limited += 1;
    if (service.status === "UNAVAILABLE") acc.unavailable += 1;
    return acc;
  }, { total: 0, available: 0, limited: 0, unavailable: 0 });
}

export function emergencySummary(cases: EmergencyCaseRecord[]) {
  return cases.reduce((acc, item) => {
    acc.total += 1;
    if (item.status !== "DISCHARGED") acc.active += 1;
    if (item.severity === "CRITICAL" && item.status !== "DISCHARGED") acc.critical += 1;
    if (item.status === "IN_TREATMENT") acc.inTreatment += 1;
    if (item.status === "RECEIVED") acc.received += 1;
    if (item.status === "STABILIZED") acc.stabilized += 1;
    return acc;
  }, { total: 0, active: 0, critical: 0, inTreatment: 0, received: 0, stabilized: 0 });
}

export function formatHospitalDate(value: string): string {
  return new Date(`${value}T00:00:00`).toLocaleDateString("en-IN", { timeZone: "Asia/Kolkata", day: "numeric", month: "short", year: "numeric" });
}

export function formatHospitalTime(value: string): string {
  return new Date(value).toLocaleTimeString("en-IN", { timeZone: "Asia/Kolkata", hour: "numeric", minute: "2-digit", hour12: true });
}
