import type { HospitalSettingsRecord } from "./hospital-data";

export const DEFAULT_HOSPITAL_SETTINGS: HospitalSettingsRecord = {
  notifications: {
    emergencyAlerts: true,
    appointmentReminders: true,
    bedCapacityAlerts: true,
    dailySummary: false,
    email: true,
    sms: false,
  },
  display: {
    landingPage: "overview",
    density: "comfortable",
    showLiveBadges: false,
    autoRefresh: false,
  },
  preferences: {
    timezone: "Asia/Kolkata",
    dateFormat: "DD MMM YYYY",
    language: "English",
    weekStart: "Monday",
  },
};
