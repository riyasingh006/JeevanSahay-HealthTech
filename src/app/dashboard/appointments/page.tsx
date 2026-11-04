"use client";

import * as React from "react";
import Link from "next/link";
import { CalendarDays, Clock3, Hospital, Stethoscope } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/components/ui/toast";

type Appointment = {
  id: string;
  scheduledAt: string;
  status: string;
  createdAt: string;
  hospital: { id: string; name: string; city: string; phone: string } | null;
  doctor: { id: string; name: string; specialty: string } | null;
};

const STATUS: Record<string, { label: string; variant: "saffron" | "green" | "red" | "neutral" }> = {
  REQUESTED: { label: "Awaiting confirmation", variant: "saffron" },
  CONFIRMED: { label: "Confirmed", variant: "green" },
  DECLINED: { label: "Declined", variant: "red" },
  CANCELLED: { label: "Cancelled", variant: "neutral" },
  COMPLETED: { label: "Completed", variant: "neutral" },
};

function indiaDateTime(value: string) {
  return new Intl.DateTimeFormat("en-IN", {
    timeZone: "Asia/Kolkata",
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(new Date(value));
}

export default function AppointmentsPage() {
  const [appointments, setAppointments] = React.useState<Appointment[] | null>(null);
  const [error, setError] = React.useState("");
  const [cancelling, setCancelling] = React.useState<string | null>(null);
  const { toast } = useToast();

  const loadAppointments = React.useCallback(async () => {
    setError("");
    try {
      const response = await fetch("/api/appointments", { cache: "no-store", headers: { Accept: "application/json" } });
      const result = await response.json();
      if (!response.ok || !result.ok) throw new Error(result.error ?? "Could not load your appointment requests.");
      setAppointments(result.data.appointments as Appointment[]);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Network problem — please try again.");
    }
  }, []);

  React.useEffect(() => { void loadAppointments(); }, [loadAppointments]);

  async function cancelAppointment(appointmentId: string) {
    setCancelling(appointmentId);
    setError("");
    try {
      const response = await fetch("/api/appointments", {
        method: "PATCH",
        headers: { "Content-Type": "application/json", Accept: "application/json" },
        body: JSON.stringify({ appointmentId }),
      });
      const result = await response.json();
      if (!response.ok || !result.ok) throw new Error(result.error ?? "This request could not be cancelled.");
      setAppointments((current) => current?.map((appointment) => appointment.id === appointmentId ? { ...appointment, status: "CANCELLED" } : appointment) ?? null);
      toast({ title: "Appointment request cancelled", variant: "success" });
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Network problem — please try again.");
    } finally {
      setCancelling(null);
    }
  }

  return (
    <div className="mx-auto max-w-3xl">
      <header>
        <h1 className="institutional-heading text-2xl">My Appointments</h1>
        <p className="mt-1 text-sm text-slate-600">Track appointment requests and hospital responses.</p>
      </header>
      <p className="mt-4 rounded-lg border border-status-info-border bg-status-info-bg px-3.5 py-3 text-sm text-status-info-fg">
        A requested date and time are preferences. Your visit is not confirmed until the hospital confirms it.
      </p>
      {error && <p role="alert" className="mt-4 rounded-lg border border-red-200 bg-red-50 px-3.5 py-3 text-sm text-red-700">{error}</p>}

      {appointments === null && (
        <div className="mt-6 space-y-3" aria-label="Loading appointment requests">
          {[0, 1, 2].map((item) => <Skeleton key={item} className="h-32 rounded-xl" />)}
        </div>
      )}

      {appointments?.length === 0 && (
        <div className="mt-6">
          <EmptyState
            icon={<CalendarDays className="h-6 w-6" aria-hidden />}
            title="No appointment requests yet"
            description="Choose a doctor from a verified hospital to send an appointment request."
            action={<Button asChild><Link href="/dashboard/doctors">Find a doctor</Link></Button>}
          />
        </div>
      )}

      {appointments && appointments.length > 0 && (
        <ul className="mt-6 space-y-3">
          {appointments.map((appointment) => {
            const status = STATUS[appointment.status] ?? { label: appointment.status, variant: "neutral" as const };
            const canCancel = ["REQUESTED", "CONFIRMED"].includes(appointment.status) && new Date(appointment.scheduledAt).getTime() > Date.now();
            return (
              <li key={appointment.id}>
                <Card>
                  <CardContent className="space-y-3 p-4 sm:p-5">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <Badge variant={status.variant}>{status.label}</Badge>
                      <span className="text-xs text-slate-500">Request {appointment.id.slice(-8).toUpperCase()}</span>
                    </div>
                    <div className="grid gap-2 text-sm text-slate-700 sm:grid-cols-2">
                      <p className="flex items-start gap-2"><Hospital className="mt-0.5 h-4 w-4 shrink-0 text-primary-700" aria-hidden /><span><span className="font-semibold text-primary-950">{appointment.hospital?.name ?? "Hospital no longer listed"}</span>{appointment.hospital?.city && <span className="block text-xs text-slate-500">{appointment.hospital.city}</span>}</span></p>
                      <p className="flex items-start gap-2"><Stethoscope className="mt-0.5 h-4 w-4 shrink-0 text-primary-700" aria-hidden /><span>{appointment.doctor ? <><span className="font-semibold text-primary-950">{appointment.doctor.name}</span><span className="block text-xs text-slate-500">{appointment.doctor.specialty.replaceAll("_", " ")}</span></> : "General appointment"}</span></p>
                      <p className="flex items-start gap-2 sm:col-span-2"><Clock3 className="mt-0.5 h-4 w-4 shrink-0 text-primary-700" aria-hidden /><time dateTime={appointment.scheduledAt}>{indiaDateTime(appointment.scheduledAt)}</time></p>
                    </div>
                    {canCancel && <div className="flex justify-end"><Button variant="secondary" size="sm" loading={cancelling === appointment.id} disabled={cancelling !== null} onClick={() => void cancelAppointment(appointment.id)}>Cancel request</Button></div>}
                  </CardContent>
                </Card>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
