"use client";

import * as React from "react";
import { CalendarDays, Clock, Info, PhoneCall } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useAuth } from "@/components/auth-context";

export interface BookingDoctor {
  id: string;
  name: string;
  specialty?: string;
  specialtyLabel?: string;
  qualification?: string | null;
  hospitalId: string;
  hospitalName: string;
  hospitalPhone?: string;
  hospitalCity?: string;
  timings?: string | null;
}

function nextDays(n: number) {
  const out: { iso: string; day: string; date: string }[] = [];
  for (let i = 0; i < n; i++) {
    const d = new Date();
    d.setDate(d.getDate() + i);
    out.push({
      iso: `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`,
      day: i === 0 ? "Today" : i === 1 ? "Tomorrow" : d.toLocaleDateString("en-IN", { weekday: "short" }),
      date: d.toLocaleDateString("en-IN", { day: "numeric", month: "short" }),
    });
  }
  return out;
}

/** Indicative consultation windows used when no live scheduling data exists. */
const DEFAULT_SLOTS = [
  "09:00 AM", "09:30 AM", "10:00 AM", "10:30 AM", "11:00 AM", "11:30 AM",
  "05:00 PM", "05:30 PM", "06:00 PM", "06:30 PM", "07:00 PM", "07:30 PM",
];

function slotsFromTimings(timings?: string | null): string[] {
  if (!timings) return DEFAULT_SLOTS;
  const match = timings.match(/(\d{1,2})(?::(\d{2}))?\s*(AM|PM)\s*[-–]\s*(\d{1,2})(?::(\d{2}))?\s*(AM|PM)/i);
  if (!match) return DEFAULT_SLOTS;
  const to24 = (h: number, m: number, ap: string) => {
    let hh = h % 12;
    if (ap.toUpperCase() === "PM") hh += 12;
    return hh * 60 + m;
  };
  const start = to24(Number(match[1]), Number(match[2] ?? 0), match[3]);
  const end = to24(Number(match[4]), Number(match[5] ?? 0), match[6]);
  if (end <= start || end - start > 10 * 60) return DEFAULT_SLOTS;
  const out: string[] = [];
  for (let t = start; t < end; t += 30) {
    const h24 = Math.floor(t / 60);
    const m = t % 60;
    const ap = h24 >= 12 ? "PM" : "AM";
    const h12 = h24 % 12 === 0 ? 12 : h24 % 12;
    out.push(`${String(h12).padStart(2, "0")}:${String(m).padStart(2, "0")} ${ap}`);
  }
  return out.length > 0 ? out : DEFAULT_SLOTS;
}

type Step = "slot" | "details" | "done";

export function AppointmentDialog({
  open,
  onOpenChange,
  doctor,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  doctor: BookingDoctor | null;
}) {
  const { user } = useAuth();
  const days = React.useMemo(() => nextDays(7), []);
  const [step, setStep] = React.useState<Step>("slot");
  const [date, setDate] = React.useState(days[0]?.iso ?? "");
  const [time, setTime] = React.useState("");
  const [name, setName] = React.useState(user?.name ?? "");
  const [phone, setPhone] = React.useState("");
  const [saving, setSaving] = React.useState(false);
  const [submitError, setSubmitError] = React.useState("");
  const [appointmentId, setAppointmentId] = React.useState<string | null>(null);

  React.useEffect(() => {
    if (open) {
      setStep("slot");
      setDate(days[0]?.iso ?? "");
      setTime("");
      setName(user?.name?.trim() || "");
      setPhone("");
      setSaving(false);
      setSubmitError("");
      setAppointmentId(null);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, doctor?.id]);

  async function submitRequest(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmitError("");
    if (!doctor) return;
    if (user?.isDemo) {
      setSubmitError("Appointment requests are disabled for demo accounts.");
      return;
    }
    setSaving(true);
    try {
      const response = await fetch("/api/appointments", {
        method: "POST",
        headers: { "Content-Type": "application/json", Accept: "application/json" },
        body: JSON.stringify({
          hospitalId: doctor.hospitalId,
          doctorId: doctor.id,
          patientName: name,
          patientPhone: phone,
          date,
          time,
        }),
      });
      const result = await response.json();
      if (!response.ok || !result.ok) {
        throw new Error(result.error ?? "We could not send your appointment request.");
      }
      setAppointmentId(result.data.appointment.id);
      setStep("done");
    } catch (error) {
      setSubmitError(error instanceof Error ? error.message : "Network problem — please try again.");
    } finally {
      setSaving(false);
    }
  }

  if (!doctor) return null;

  const slots = slotsFromTimings(doctor.timings);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Book Appointment</DialogTitle>
          <DialogDescription>
            {doctor.name}
            {doctor.specialtyLabel ? ` · ${doctor.specialtyLabel}` : ""} —{" "}
            {doctor.hospitalName}
          </DialogDescription>
        </DialogHeader>

        <p className="flex items-start gap-2 rounded-lg border border-status-info-border bg-status-info-bg px-3 py-2.5 text-xs font-medium text-status-info-fg">
          <Info className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
          {user?.isDemo
            ? "Demo accounts cannot submit appointment requests. No request will be sent to a hospital."
            : "This request is saved to your account but does not reserve a slot. Call the hospital to confirm availability before visiting."}
        </p>

        {step === "slot" && (
          <div className="space-y-4">
            <fieldset>
              <legend className="data-label mb-2">Select date</legend>
              <div className="grid grid-cols-4 gap-2 sm:grid-cols-7">
                {days.map((d) => (
                  <button
                    key={d.iso}
                    type="button"
                    onClick={() => setDate(d.iso)}
                    aria-pressed={date === d.iso}
                    className={`rounded-lg border px-1 py-2 text-center text-xs transition-colors ${
                      date === d.iso
                        ? "border-primary-700 bg-primary-700 text-white"
                        : "border-slate-300 bg-white text-slate-700 hover:border-primary-400"
                    }`}
                  >
                    <span className="block font-semibold">{d.day}</span>
                    <span className="block text-[11px] opacity-80">{d.date}</span>
                  </button>
                ))}
              </div>
            </fieldset>

            <fieldset>
              <legend className="data-label mb-2 flex items-center gap-1.5">
                <Clock className="h-3.5 w-3.5" aria-hidden /> Preferred time
              </legend>
              <div className="grid grid-cols-3 gap-2 sm:grid-cols-4">
                {slots.map((s) => (
                  <button
                    key={s}
                    type="button"
                    onClick={() => setTime(s)}
                    aria-pressed={time === s}
                    className={`rounded-lg border px-2 py-2 text-xs font-medium transition-colors ${
                      time === s
                        ? "border-care-600 bg-care-600 text-white"
                        : "border-slate-300 bg-white text-slate-700 hover:border-care-500"
                    }`}
                  >
                    {s}
                  </button>
                ))}
              </div>
            </fieldset>
            <p className="text-xs text-slate-500">Times are suggestions based on posted clinic hours, not live availability. The hospital must confirm your request.</p>

            <Button
              size="lg"
              className="w-full"
              disabled={!time || user?.isDemo === true}
              onClick={() => setStep("details")}
            >
              Continue
            </Button>
          </div>
        )}

        {step === "details" && (
          <form className="space-y-4" onSubmit={submitRequest}>
            <div className="space-y-1.5">
              <Label htmlFor="appt-name">Patient name *</Label>
              <Input
                id="appt-name"
                required
                minLength={2}
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Full name"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="appt-phone">Mobile number *</Label>
              <Input
                id="appt-phone"
                required
                type="tel"
                inputMode="tel"
                minLength={6}
                maxLength={16}
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="+91 …"
              />
            </div>

            <div className="rounded-lg border border-slate-200 bg-slate-50 p-3 text-sm text-slate-700">
              <p className="data-label mb-1">Summary</p>
              <p className="font-medium text-primary-950">{doctor.hospitalName}</p>
              <p className="mt-0.5">
                Dr. {doctor.name} ·{" "}
                {doctor.specialtyLabel ?? doctor.specialty}
              </p>
              <p className="mt-0.5 flex items-center gap-1.5">
                <CalendarDays className="h-3.5 w-3.5" aria-hidden />
                {new Date(date + "T00:00:00").toLocaleDateString("en-IN", {
                  weekday: "long",
                  day: "numeric",
                  month: "long",
                })}{" "}
                at {time}
              </p>
            </div>

            {submitError && <p role="alert" className="rounded-lg border border-red-200 bg-red-50 px-3 py-2.5 text-sm text-red-700">{submitError}</p>}

            <div className="grid gap-2 sm:grid-cols-2">
              <Button type="button" variant="secondary" size="lg" onClick={() => setStep("slot")}>
                Back
              </Button>
              <Button type="submit" variant="primary" size="lg" loading={saving} disabled={user?.isDemo === true}>
                Send Appointment Request
              </Button>
            </div>
          </form>
        )}

        {step === "done" && (
          <div className="space-y-4">
            <Badge variant="saffron" size="md">
              Request recorded — confirmation pending
            </Badge>
            <div className="rounded-lg border border-dashed border-slate-300 p-4">
              <p className="text-sm font-semibold text-primary-950">
                {doctor.hospitalName}
              </p>
              <p className="mt-0.5 text-sm text-slate-600">
                Dr. {doctor.name} — {new Date(date + "T00:00:00").toLocaleDateString("en-IN", { day: "numeric", month: "short" })} at {time}
              </p>
              <p className="mt-0.5 text-sm text-slate-600">
                Patient: {name} · {phone}
              </p>
              {appointmentId && <p className="mt-2 text-xs text-slate-500">Request reference: {appointmentId}</p>}
              <p className="mt-2 text-xs text-slate-500">This request is not a confirmed appointment. Contact the hospital to verify availability.</p>
            </div>
            {doctor.hospitalPhone && (
              <a href={`tel:${doctor.hospitalPhone.replace(/\s/g, "")}`}>
                <Button variant="success" size="lg" className="w-full gap-2">
                  <PhoneCall className="h-4 w-4" aria-hidden /> Call hospital to
                  confirm ({doctor.hospitalPhone})
                </Button>
              </a>
            )}
            <Button variant="secondary" className="w-full" onClick={() => onOpenChange(false)}>
              Close
            </Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
