import { Info } from "lucide-react";

export function DemoDataBadge() {
  return (
    <span className="inline-flex items-center rounded-full border border-amber-300 bg-amber-50 px-2.5 py-1 text-[11px] font-semibold text-amber-900">
      Demo data
    </span>
  );
}

export function FacilityReportedNotice() {
  return (
    <p className="flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 px-3.5 py-2.5 text-xs leading-relaxed text-amber-950">
      <Info className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden />
      <span>Availability, service and staffing details are facility-reported, not a live feed, and may be outdated. Call the hospital to confirm before travelling. This service does not dispatch emergency care; call 112 in an emergency.</span>
    </p>
  );
}

export function DemoFacilityNotice() {
  return (
    <p className="flex items-start gap-2 rounded-lg border border-amber-300 bg-amber-50 px-3.5 py-2.5 text-xs leading-relaxed text-amber-950">
      <Info className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden />
      <span>Sample record only. This does not represent a real facility, its location, capacity, staffing or emergency readiness.</span>
    </p>
  );
}

export function DemoAccountNotice({ audience }: { audience: "patient" | "hospital" }) {
  const message: Record<typeof audience, string> = {
    patient: "This patient account and its profile, saved items and notifications are synthetic sample data. Demo facility records are for testing only; do not rely on them for care decisions.",
    hospital: "This hospital account and its facility, patient, appointment and emergency records are synthetic sample data. Do not use them to manage a real facility or respond to an emergency.",
  };
  return (
    <aside role="note" className="mb-5 flex items-start gap-3 rounded-xl border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-950">
      <DemoDataBadge />
      <span>{message[audience]}</span>
    </aside>
  );
}
