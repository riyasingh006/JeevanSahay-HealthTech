import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { auditHospitalChange, withHospitalApi } from "@/lib/hospital/portal-api";
import type { HospitalSettingsRecord } from "@/lib/hospital/hospital-data";
import { ok, parseBody } from "@/lib/api-helpers";

const defaults: HospitalSettingsRecord = {
  notifications: {
    emergencyAlerts: true,
    appointmentReminders: true,
    bedCapacityAlerts: true,
    dailySummary: false,
    email: false,
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

const settingsSchema = z.object({
  notifications: z.object({
    emergencyAlerts: z.boolean(),
    appointmentReminders: z.boolean(),
    bedCapacityAlerts: z.boolean(),
    dailySummary: z.boolean(),
    email: z.boolean(),
    sms: z.boolean(),
  }),
  display: z.object({
    landingPage: z.enum(["overview", "beds", "appointments"]),
    density: z.enum(["comfortable", "compact"]),
    showLiveBadges: z.boolean(),
    autoRefresh: z.boolean(),
  }),
  preferences: z.object({
    timezone: z.string().trim().min(1).max(80),
    dateFormat: z.enum(["DD MMM YYYY", "MM/DD/YYYY", "YYYY-MM-DD"]),
    language: z.enum(["English", "Hindi"]),
    weekStart: z.enum(["Monday", "Sunday"]),
  }),
});

export const GET = withHospitalApi(async (_req, { hospital }) => {
  const record = await prisma.hospitalSettings.findUnique({ where: { hospitalId: hospital.id } });
  if (!record) return ok({ settings: defaults });
  try {
    const stored = settingsSchema.partial().parse(JSON.parse(record.configJson));
    return ok({
      settings: {
        notifications: { ...defaults.notifications, ...stored.notifications },
        display: { ...defaults.display, ...stored.display },
        preferences: { ...defaults.preferences, ...stored.preferences },
      },
    });
  } catch {
    return ok({ settings: defaults });
  }
});

export const PATCH = withHospitalApi(async (req, context) => {
  const parsed = await parseBody(req, settingsSchema);
  if (parsed.error) return parsed.error;
  const configJson = JSON.stringify(parsed.data);
  const record = await prisma.hospitalSettings.upsert({
    where: { hospitalId: context.hospital.id },
    create: { hospitalId: context.hospital.id, configJson },
    update: { configJson },
  });
  await auditHospitalChange(context, "SETTINGS_UPDATED", "HospitalSettings", record.id);
  return ok({ settings: parsed.data });
}, { limit: 30, windowMs: 60_000, keyPrefix: "hospital-settings" });
