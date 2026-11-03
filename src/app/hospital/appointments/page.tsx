"use client";

import * as React from "react";
import { CalendarClock, Search } from "lucide-react";
import { useHospitalPortal } from "@/components/hospital/hospital-store";
import {
  LiveRecordsNotice,
  HospitalStatusBadge,
  NativeSelect,
  PageHeader,
  SectionCard,
  StatCard,
} from "@/components/hospital/hospital-ui";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { useToast } from "@/components/ui/toast";
import {
  appointmentStatusCounts,
  todayAppointments,
  type AppointmentStatus,
} from "@/lib/hospital/hospital-data";
import { todayHospitalLabel } from "@/components/hospital/hospital-ui";

const STATUS_OPTS: AppointmentStatus[] = ["REQUESTED", "CONFIRMED", "DECLINED", "COMPLETED", "CANCELLED", "NO_SHOW"];

export default function HospitalAppointmentsPage() {
  const { appointments, updateAppointmentStatus, loading } = useHospitalPortal();
  const { toast } = useToast();
  const [query, setQuery] = React.useState("");
  const [deptFilter, setDeptFilter] = React.useState("all");
  const [statusFilter, setStatusFilter] = React.useState("all");
  const [dateFilter, setDateFilter] = React.useState("all");
  const [updatingId, setUpdatingId] = React.useState<string | null>(null);

  const counts = appointmentStatusCounts(appointments);
  const todays = todayAppointments(appointments);
  const depts = React.useMemo(() => Array.from(new Set(appointments.map((a) => a.department))), [appointments]);
  const dates = React.useMemo(() => Array.from(new Set(appointments.map((a) => a.date))).sort(), [appointments]);

  const filtered = React.useMemo(() => {
    const q = query.trim().toLowerCase();
    return appointments.filter((a) => {
      if (deptFilter !== "all" && a.department !== deptFilter) return false;
      if (statusFilter !== "all" && a.status !== statusFilter) return false;
      if (dateFilter !== "all" && a.date !== dateFilter) return false;
      if (!q) return true;
      return (
        a.reference.toLowerCase().includes(q) ||
        a.patientRef.toLowerCase().includes(q) ||
        a.doctorName.toLowerCase().includes(q)
      );
    });
  }, [appointments, query, deptFilter, statusFilter, dateFilter]);

  async function updateStatus(id: string, status: AppointmentStatus) {
    setUpdatingId(id);
    const result = await updateAppointmentStatus(id, status);
    setUpdatingId(null);
    toast(result.ok
      ? { title: "Appointment updated", description: "The patient has been notified of the status change.", variant: "success" }
      : { title: "Could not update appointment", description: result.error, variant: "error" });
  }

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Hospital Management"
        title="Appointments"
        description="Manage current appointment requests with references, doctors, departments, times and status updates."
        icon={CalendarClock}
      />

      <LiveRecordsNotice>
        Patient-submitted appointment requests are stored for this hospital. Contact details are visible only to its authorised staff.
      </LiveRecordsNotice>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
        <StatCard label="Total" value={counts.total} hint="All appointments" icon={CalendarClock} tone="blue" />
        <StatCard label="Today (active)" value={todays.length} hint={todayHospitalLabel()} icon={CalendarClock} tone="teal" />
        <StatCard label="Requested" value={counts.requested} hint="Awaiting hospital response" icon={CalendarClock} tone="amber" />
        <StatCard label="Confirmed" value={counts.confirmed} hint="Patient appointments" icon={CalendarClock} tone="blue" />
        <StatCard label="Completed / Closed" value={counts.completed + counts.declined + counts.cancelled} hint={`${counts.noShow} no show`} icon={CalendarClock} tone="green" />
      </div>

      <SectionCard
        title="Appointment List"
        description={`${filtered.length} appointments shown`}
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <div className="relative">
              <Search className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" aria-hidden />
              <Input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search ref, patient, doctor" className="h-9 w-64 pl-9" />
            </div>
            <NativeSelect value={dateFilter} onChange={(e) => setDateFilter(e.target.value)} className="h-9 w-44">
              <option value="all">All dates</option>
              {dates.map((d) => <option key={d} value={d}>{d}</option>)}
            </NativeSelect>
            <NativeSelect value={deptFilter} onChange={(e) => setDeptFilter(e.target.value)} className="h-9 w-48">
              <option value="all">All departments</option>
              {depts.map((d) => <option key={d} value={d}>{d}</option>)}
            </NativeSelect>
            <NativeSelect value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} className="h-9 w-40">
              <option value="all">All statuses</option>
              {STATUS_OPTS.map((s) => <option key={s} value={s}>{s}</option>)}
            </NativeSelect>
          </div>
        }
      >
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Reference</TableHead>
                <TableHead>Patient</TableHead>
                <TableHead>Doctor</TableHead>
                <TableHead>Department</TableHead>
                <TableHead>Date & Time</TableHead>
                <TableHead>Type</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Update</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map((apt) => (
                <TableRow key={apt.id}>
                  <TableCell className="font-medium tabular-nums text-primary-950">{apt.reference}</TableCell>
                  <TableCell className="text-sm text-slate-700">{apt.patientRef}</TableCell>
                  <TableCell className="text-sm text-slate-700">{apt.doctorName}</TableCell>
                  <TableCell className="text-sm text-slate-600">{apt.department}</TableCell>
                  <TableCell className="text-sm text-slate-600">{apt.date} • {apt.time}</TableCell>
                  <TableCell className="text-sm text-slate-600">{apt.type}</TableCell>
                  <TableCell><HospitalStatusBadge status={apt.status} size="sm" /></TableCell>
                  <TableCell className="text-right">
                    <NativeSelect
                      value={apt.status}
                      disabled={updatingId === apt.id}
                      onChange={(ev) => void updateStatus(apt.id, ev.target.value as AppointmentStatus)}
                      className="ml-auto h-8 w-36 text-xs"
                    >
                      {[apt.status, ...(apt.status === "REQUESTED" ? ["CONFIRMED", "DECLINED"] : apt.status === "CONFIRMED" ? ["COMPLETED", "CANCELLED", "NO_SHOW"] : [])].map((status) => <option key={status} value={status}>{status.replaceAll("_", " ")}</option>)}
                    </NativeSelect>
                  </TableCell>
                </TableRow>
              ))}
              {!loading && filtered.length === 0 && (
                <TableRow>
                  <TableCell colSpan={8} className="h-24 text-center text-sm text-slate-500">
                    {appointments.length === 0 ? "No appointment requests have been received yet." : "No appointments match the current search or filters."}
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </div>
      </SectionCard>
    </div>
  );
}
