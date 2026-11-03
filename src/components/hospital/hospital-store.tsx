"use client";

import * as React from "react";
import type {
  AppointmentRecord,
  AppointmentStatus,
  BedInventoryRecord,
  BedRecord,
  BedStatus,
  DepartmentRecord,
  DoctorAvailability,
  DoctorRecord,
  EmergencyCaseRecord,
  EmergencyStatus,
  HospitalActivity,
  HospitalNotification,
  HospitalProfileRecord,
  HospitalSettingsRecord,
  ServiceRecord,
} from "@/lib/hospital/hospital-data";

export interface NewBedInput {
  id: string;
  ward: string;
  bedType: BedRecord["bedType"];
  department: string;
  status: BedStatus;
}

export interface NewDoctorInput {
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

export type DoctorPatch = Partial<Omit<DoctorRecord, "id">> & { id?: never };

export interface NewDepartmentInput {
  name: string;
  head: string;
  status: DepartmentRecord["status"];
  location: string;
  description: string;
}

export interface NewServiceInput {
  name: string;
  department: string;
  status: ServiceRecord["status"];
  hours: string;
  description: string;
}

export type MutationResult = { ok: true } | { ok: false; error: string };

type TrendPoint = {
  date: string;
  emergency: number;
  appointments: number;
};

interface HospitalContextValue {
  loading: boolean;
  error: string | null;
  refresh: () => Promise<void>;
  beds: BedRecord[];
  bedInventory: BedInventoryRecord[];
  doctors: DoctorRecord[];
  departments: DepartmentRecord[];
  emergencyCases: EmergencyCaseRecord[];
  services: ServiceRecord[];
  appointments: AppointmentRecord[];
  profile: HospitalProfileRecord;
  settings: HospitalSettingsRecord;
  notifications: HospitalNotification[];
  activity: HospitalActivity[];
  trend: TrendPoint[];
  addBed: (input: NewBedInput) => Promise<MutationResult>;
  updateBed: (id: string, patch: Partial<Omit<BedRecord, "id">>) => Promise<MutationResult>;
  removeBed: (id: string) => Promise<MutationResult>;
  addDoctor: (input: NewDoctorInput) => Promise<MutationResult>;
  updateDoctor: (id: string, patch: DoctorPatch) => Promise<MutationResult>;
  toggleDoctorAvailability: (id: string) => Promise<MutationResult>;
  removeDoctor: (id: string) => Promise<MutationResult>;
  addDepartment: (input: NewDepartmentInput) => Promise<MutationResult>;
  updateDepartment: (id: string, patch: Partial<Omit<DepartmentRecord, "id">>) => Promise<MutationResult>;
  addService: (input: NewServiceInput) => Promise<MutationResult>;
  updateService: (id: string, patch: Partial<Omit<ServiceRecord, "id">>) => Promise<MutationResult>;
  removeService: (id: string) => Promise<MutationResult>;
  updateEmergencyStatus: (id: string, status: EmergencyStatus) => Promise<MutationResult>;
  addEmergencyCase: (input: Omit<EmergencyCaseRecord, "id" | "reference" | "reportedAt" | "status"> & { reference?: string }) => Promise<MutationResult>;
  updateAppointmentStatus: (id: string, status: AppointmentStatus, note?: string) => Promise<MutationResult>;
  updateProfile: (patch: Partial<HospitalProfileRecord>) => Promise<MutationResult>;
  updateSettings: (patch: Partial<HospitalSettingsRecord>) => Promise<MutationResult>;
  markNotificationRead: (id: string) => Promise<MutationResult>;
  markAllNotificationsRead: () => Promise<MutationResult>;
}

const defaults: {
  beds: BedRecord[];
  bedInventory: BedInventoryRecord[];
  doctors: DoctorRecord[];
  departments: DepartmentRecord[];
  emergencyCases: EmergencyCaseRecord[];
  services: ServiceRecord[];
  appointments: AppointmentRecord[];
  profile: HospitalProfileRecord;
  settings: HospitalSettingsRecord;
  notifications: HospitalNotification[];
  activity: HospitalActivity[];
  trend: TrendPoint[];
} = {
  beds: [],
  bedInventory: [],
  doctors: [],
  departments: [],
  emergencyCases: [],
  services: [],
  appointments: [],
  profile: {
    name: "", type: "PRIVATE", registrationNumber: "", addressLine: "", city: "", state: "", pincode: "", phone: "", emergencyPhone: "", email: "", website: "", accreditation: "", established: new Date().getFullYear(), about: "",
  },
  settings: {
    notifications: { emergencyAlerts: true, appointmentReminders: true, bedCapacityAlerts: true, dailySummary: false, email: false, sms: false },
    display: { landingPage: "overview", density: "comfortable", showLiveBadges: false, autoRefresh: false },
    preferences: { timezone: "Asia/Kolkata", dateFormat: "DD MMM YYYY", language: "English", weekStart: "Monday" },
  },
  notifications: [],
  activity: [],
  trend: [],
};

const HospitalContext = React.createContext<HospitalContextValue | null>(null);

export function HospitalPortalProvider({ children }: { children: React.ReactNode }) {
  const [data, setData] = React.useState(defaults);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);
  const hasLoaded = React.useRef(false);

  const refresh = React.useCallback(async () => {
    if (!hasLoaded.current) setLoading(true);
    try {
      const response = await fetch("/api/hospital/portal", {
        cache: "no-store",
        headers: { Accept: "application/json" },
      });
      const result = await response.json();
      if (!response.ok || !result.ok) throw new Error(result.error ?? "Hospital records could not be loaded.");
      setData({ ...defaults, ...result.data });
      setError(null);
      hasLoaded.current = true;
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Hospital records could not be loaded.");
    } finally {
      setLoading(false);
    }
  }, []);

  React.useEffect(() => {
    void refresh();
  }, [refresh]);

  const mutate = React.useCallback(async (path: string, method: string, body?: unknown): Promise<MutationResult> => {
    try {
      const response = await fetch(path, {
        method,
        headers: { Accept: "application/json", ...(body === undefined ? {} : { "Content-Type": "application/json" }) },
        ...(body === undefined ? {} : { body: JSON.stringify(body) }),
      });
      const result = await response.json();
      if (!response.ok || !result.ok) return { ok: false, error: result.error ?? "The change could not be saved." };
      await refresh();
      return { ok: true };
    } catch {
      return { ok: false, error: "Network problem. Your change was not confirmed; refresh and check before retrying." };
    }
  }, [refresh]);

  const value = React.useMemo<HospitalContextValue>(() => ({
    loading,
    error,
    refresh,
    ...data,
    addBed: (input) => mutate("/api/hospital/beds", "POST", input),
    updateBed: (id, patch) => mutate(`/api/hospital/beds/${encodeURIComponent(id)}`, "PATCH", patch),
    removeBed: (id) => mutate(`/api/hospital/beds/${encodeURIComponent(id)}`, "DELETE"),
    addDoctor: (input) => mutate("/api/hospital/doctors", "POST", { ...input, timings: input.shift }),
    updateDoctor: (id, patch) => {
      const { shift, ...rest } = patch;
      return mutate(`/api/hospital/doctors/${encodeURIComponent(id)}`, "PATCH", { ...rest, ...(shift === undefined ? {} : { timings: shift }) });
    },
    toggleDoctorAvailability: async (id) => {
      const doctor = data.doctors.find((item) => item.id === id);
      if (!doctor) return { ok: false, error: "Doctor not found." };
      return mutate(`/api/hospital/doctors/${encodeURIComponent(id)}`, "PATCH", { availability: doctor.availability === "UNAVAILABLE" ? "AVAILABLE" : "UNAVAILABLE" });
    },
    removeDoctor: (id) => mutate(`/api/hospital/doctors/${encodeURIComponent(id)}`, "DELETE"),
    addDepartment: (input) => mutate("/api/hospital/departments", "POST", input),
    updateDepartment: (id, patch) => mutate(`/api/hospital/departments/${encodeURIComponent(id)}`, "PATCH", patch),
    addService: (input) => mutate("/api/hospital/services", "POST", { ...input, description: input.description }),
    updateService: (id, patch) => mutate(`/api/hospital/services/${encodeURIComponent(id)}`, "PATCH", patch),
    removeService: (id) => mutate(`/api/hospital/services/${encodeURIComponent(id)}`, "DELETE"),
    updateEmergencyStatus: (id, status) => mutate(`/api/hospital/emergencies/${encodeURIComponent(id)}`, "PATCH", { status }),
    addEmergencyCase: (input) => mutate("/api/hospital/emergencies", "POST", input),
    updateAppointmentStatus: (id, status, note) => mutate("/api/hospital/appointments", "PATCH", { appointmentId: id, status, note }),
    updateProfile: (patch) => mutate("/api/hospital/profile", "PATCH", { ...data.profile, ...patch }),
    updateSettings: (patch) => mutate("/api/hospital/settings", "PATCH", {
      notifications: { ...data.settings.notifications, ...patch.notifications },
      display: { ...data.settings.display, ...patch.display },
      preferences: { ...data.settings.preferences, ...patch.preferences },
    }),
    markNotificationRead: (id) => mutate("/api/hospital/notifications", "PATCH", { id }),
    markAllNotificationsRead: () => mutate("/api/hospital/notifications", "PATCH", { all: true }),
  }), [data, error, loading, mutate, refresh]);

  return <HospitalContext.Provider value={value}>{children}</HospitalContext.Provider>;
}

export function useHospitalPortal(): HospitalContextValue {
  const context = React.useContext(HospitalContext);
  if (!context) throw new Error("useHospitalPortal must be used within HospitalPortalProvider.");
  return context;
}
