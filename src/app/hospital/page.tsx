"use client";

import Link from "next/link";
import {
  Activity,
  Ambulance,
  ArrowRight,
  BedDouble,
  Building2,
  CalendarClock,
  HeartPulse,
  LayoutDashboard,
  Siren,
  Stethoscope,
} from "lucide-react";
import { useHospitalPortal } from "@/components/hospital/hospital-store";
import {
  LiveRecordsNotice,
  HospitalStatusBadge,
  LegendDot,
  OccupancyDonut,
  PageHeader,
  ProgressBar,
  SectionCard,
  StatCard,
  todayHospitalLabel,
} from "@/components/hospital/hospital-ui";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  availableBedsByType,
  bedInventoryCounts,
  bedInventoryByType,
  departmentBedSummary,
  departmentDoctorCount,
  doctorAvailabilityCounts,
  emergencySummary,
  formatHospitalTime,
  serviceStatusCounts,
  todayAppointments,
} from "@/lib/hospital/hospital-data";
import { cn } from "@/lib/utils";

function timeAgo(value: string): string {
  const then = new Date(value).getTime();
  const diff = Date.now() - then;
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "Just now";
  if (mins < 60) return `${mins} min ago`;
  const hrs = Math.floor(mins / 60);
  return `${hrs} hr${hrs > 1 ? "s" : ""} ago`;
}

export default function HospitalDashboardPage() {
  const {
    beds,
    bedInventory,
    doctors,
    departments,
    emergencyCases,
    services,
    appointments,
    profile,
    activity,
  } = useHospitalPortal();

  const counts = bedInventoryCounts(bedInventory, beds);
  const byType = bedInventoryByType(bedInventory, beds);
  const docCounts = doctorAvailabilityCounts(doctors);
  const deptSummary = departmentBedSummary(beds, departments);
  const svcCounts = serviceStatusCounts(services);
  const erSummary = emergencySummary(emergencyCases);
  const todaysAppointments = todayAppointments(appointments);
  const icuAvailable = availableBedsByType(bedInventory, beds, "ICU");
  const occupancy = counts.total ? Math.round((counts.occupied / counts.total) * 100) : 0;

  const quickActions = [
    {
      href: "/hospital/doctors",
      label: "Add Doctor",
      icon: Stethoscope,
    },
    {
      href: "/hospital/beds",
      label: "Update Beds",
      icon: BedDouble,
    },
    {
      href: "/hospital/departments",
      label: "Manage Departments",
      icon: Building2,
    },
    {
      href: "/hospital/analytics",
      label: "View Reports",
      icon: Activity,
    },
  ];

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Hospital Portal"
        title="Hospital Overview"
        description={`${profile.name} • ${profile.city}, ${profile.state} • ${todayHospitalLabel()}`}
        icon={LayoutDashboard}
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <Button variant="secondary" size="sm" className="gap-1.5" asChild>
              <Link href="/hospital/notifications">
                <Activity className="h-3.5 w-3.5" aria-hidden />
                View activity
              </Link>
            </Button>
            <Button size="sm" className="gap-1.5" asChild>
              <Link href="/hospital/emergency">
                <Siren className="h-3.5 w-3.5" aria-hidden />
                Emergency status
              </Link>
            </Button>
          </div>
        }
      />

      <LiveRecordsNotice>
        Figures come from records saved by this verified hospital. Bed availability and service status are self-reported here, not synchronized from an external hospital information system.
      </LiveRecordsNotice>

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          label="Total Beds"
          value={counts.total}
          hint="Across all wards & categories"
          icon={BedDouble}
          tone="blue"
        />
        <StatCard
          label="Available Beds"
          value={counts.available}
          hint={`${occupancy}% occupied • ${counts.reserved} reserved`}
          icon={BedDouble}
          tone="green"
        />
        <StatCard
          label="Occupied Beds"
          value={counts.occupied}
          hint={`${counts.maintenance} under maintenance`}
          icon={BedDouble}
          tone="amber"
        />
        <StatCard
          label="Available ICU Beds"
          value={icuAvailable}
          hint={`${erSummary.critical} active critical cases`}
          icon={Ambulance}
          tone="red"
        />
        <StatCard
          label="Total Doctors"
          value={docCounts.total}
          hint={`${docCounts.available} available • ${docCounts.limited} limited`}
          icon={Stethoscope}
          tone="violet"
        />
        <StatCard
          label="Active Departments"
          value={departments.filter((d) => d.status === "ACTIVE").length}
          hint={`${departments.length} total departments`}
          icon={Building2}
          tone="teal"
        />
        <StatCard
          label="Today's Appointments"
          value={todaysAppointments.length}
          hint={`${appointments.filter((a) => a.status === "CONFIRMED").length} confirmed`}
          icon={CalendarClock}
          tone="blue"
        />
        <StatCard
          label="Emergency Cases (Active)"
          value={erSummary.active}
          hint={`${erSummary.critical} critical • ${erSummary.inTreatment} in treatment`}
          icon={Siren}
          tone="red"
        />
      </div>

      <div className="grid gap-6 xl:grid-cols-12">
        <div className="space-y-6 xl:col-span-7">
          <SectionCard
            title="Bed Occupancy Overview"
            description="Ward-wise distribution with availability against occupancy."
            actions={
              <Button variant="ghost" size="sm" className="gap-1.5" asChild>
                <Link href="/hospital/beds">
                  Manage beds
                  <ArrowRight className="h-3.5 w-3.5" aria-hidden />
                </Link>
              </Button>
            }
          >
            <div className="flex flex-col gap-5 lg:flex-row lg:items-center">
              <OccupancyDonut occupied={counts.occupied} total={counts.total} />
              <div className="flex-1 space-y-3">
                <div className="flex items-center justify-between text-sm">
                  <span className="font-semibold text-primary-950">
                    Overall occupancy
                  </span>
                  <span className="tabular-nums text-slate-600">
                    {counts.occupied} / {counts.total} beds
                  </span>
                </div>
                <ProgressBar value={occupancy} tone={occupancy >= 85 ? "red" : occupancy >= 65 ? "amber" : "green"} />
                <div className="grid gap-2 sm:grid-cols-2">
                  <LegendDot color="bg-primary-600" label="Occupied" value={counts.occupied} />
                  <LegendDot color="bg-india-500" label="Available" value={counts.available} />
                  <LegendDot color="bg-saffron-500" label="Reserved" value={counts.reserved} />
                  <LegendDot color="bg-slate-400" label="Maintenance" value={counts.maintenance} />
                </div>
              </div>
            </div>
            <div className="mt-5 grid gap-2 md:grid-cols-2">
              {byType.map((entry) => (
                <div
                  key={entry.bedType}
                  className="flex items-center justify-between rounded-lg border border-slate-200 px-3.5 py-2.5"
                >
                  <div>
                    <p className="text-sm font-medium text-primary-950">{entry.bedType}</p>
                    <p className="text-xs text-slate-500">
                      {entry.available} available of {entry.total}
                    </p>
                  </div>
                  <div className="w-28">
                    <ProgressBar
                      value={entry.total ? Math.round((entry.occupied / entry.total) * 100) : 0}
                      tone="blue"
                    />
                  </div>
                </div>
              ))}
            </div>
          </SectionCard>

          <SectionCard
            title="Department-wise Summary"
            description="Doctors and bed utilization across clinical departments."
          >
            <div className="space-y-2">
              {deptSummary.slice(0, 7).map((dept) => (
                <div
                  key={dept.id}
                  className="flex flex-col gap-2 rounded-lg border border-slate-200 p-3 sm:flex-row sm:items-center sm:justify-between"
                >
                  <div className="min-w-0">
                    <p className="font-medium text-primary-950">{dept.name}</p>
                    <p className="text-xs text-slate-500">
                      Head: {dept.head} • {dept.location}
                    </p>
                  </div>
                  <div className="flex flex-wrap items-center gap-3 text-xs">
                    <span className="rounded-full bg-primary-50 px-2 py-1 text-primary-700">
                      {departmentDoctorCount(doctors, dept.name)} doctors
                    </span>
                    <span className="rounded-full bg-care-50 px-2 py-1 text-care-700">
                      {dept.availableBeds} / {dept.totalBeds} beds free
                    </span>
                    <span className="w-24">
                      <ProgressBar value={dept.utilization} tone={dept.utilization >= 80 ? "amber" : "teal"} />
                    </span>
                    <HospitalStatusBadge status={dept.status} size="sm" />
                  </div>
                </div>
              ))}
            </div>
          </SectionCard>

          <SectionCard
            title="Today's Appointment Schedule"
            description="Patient-submitted appointment requests scheduled for today."
            actions={
              <Button variant="ghost" size="sm" className="gap-1.5" asChild>
                <Link href="/hospital/appointments">
                  View all
                  <ArrowRight className="h-3.5 w-3.5" aria-hidden />
                </Link>
              </Button>
            }
          >
            <div className="space-y-2">
              {todaysAppointments.length === 0 && (
                <div className="flex items-center justify-center rounded-lg border border-dashed border-slate-300 py-8 text-sm text-slate-500">
                  No patient appointments are scheduled for today.
                </div>
              )}
              {todaysAppointments.map((apt) => (
                <div
                  key={apt.id}
                  className="flex flex-col gap-2 rounded-lg border border-slate-200 p-3 sm:flex-row sm:items-center sm:justify-between"
                >
                  <div>
                    <p className="font-medium text-primary-950">
                      {apt.patientRef} • {apt.doctorName}
                    </p>
                    <p className="text-xs text-slate-500">
                      {apt.reference} • {apt.department} • {apt.type}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="rounded-full bg-slate-100 px-2 py-1 text-xs text-slate-600">
                      {apt.time}
                    </span>
                    <HospitalStatusBadge status={apt.status} size="sm" />
                  </div>
                </div>
              ))}
            </div>
          </SectionCard>
        </div>

        <div className="space-y-6 xl:col-span-5">
          <SectionCard
            title="Emergency Status Summary"
            description="Cases recorded by this hospital, with severity and department."
            actions={
              <Button variant="ghost" size="sm" className="gap-1.5" asChild>
                <Link href="/hospital/emergency">
                  Open emergency
                  <ArrowRight className="h-3.5 w-3.5" aria-hidden />
                </Link>
              </Button>
            }
          >
            <div className="grid grid-cols-2 gap-2">
              <Card className="border-slate-200">
                <CardContent className="p-3">
                  <p className="text-[11px] uppercase tracking-wide text-slate-500">Active</p>
                  <p className="text-xl font-bold tabular-nums text-primary-950">{erSummary.active}</p>
                </CardContent>
              </Card>
              <Card className="border-slate-200">
                <CardContent className="p-3">
                  <p className="text-[11px] uppercase tracking-wide text-slate-500">Critical</p>
                  <p className="text-xl font-bold tabular-nums text-red-700">{erSummary.critical}</p>
                </CardContent>
              </Card>
              <Card className="border-slate-200">
                <CardContent className="p-3">
                  <p className="text-[11px] uppercase tracking-wide text-slate-500">In treatment</p>
                  <p className="text-xl font-bold tabular-nums text-saffron-700">{erSummary.inTreatment}</p>
                </CardContent>
              </Card>
              <Card className="border-slate-200">
                <CardContent className="p-3">
                  <p className="text-[11px] uppercase tracking-wide text-slate-500">Stabilized</p>
                  <p className="text-xl font-bold tabular-nums text-india-600">{erSummary.stabilized}</p>
                </CardContent>
              </Card>
            </div>
            <div className="mt-4 space-y-2">
              {emergencyCases.filter((e) => e.status !== "DISCHARGED").slice(0, 3).map((e) => (
                <div key={e.id} className="rounded-lg border border-slate-200 p-3">
                  <div className="flex items-center justify-between">
                    <p className="text-sm font-medium text-primary-950">
                      {e.patientRef} • {e.age}y
                    </p>
                    <HospitalStatusBadge status={e.severity} size="sm" />
                  </div>
                  <p className="mt-1 text-xs leading-relaxed text-slate-600">{e.condition}</p>
                  <div className="mt-2 flex items-center justify-between text-[11px] text-slate-500">
                    <span>
                      {e.reference} • {e.location} • {e.department}
                    </span>
                    <span>{formatHospitalTime(e.reportedAt)}</span>
                  </div>
                </div>
              ))}
            </div>
          </SectionCard>

          <SectionCard
            title="Doctor Availability Overview"
            description="Availability recorded for this hospital's clinical teams."
            actions={
              <Button variant="ghost" size="sm" className="gap-1.5" asChild>
                <Link href="/hospital/doctors">
                  Manage doctors
                  <ArrowRight className="h-3.5 w-3.5" aria-hidden />
                </Link>
              </Button>
            }
          >
            <div className="space-y-2">
              {doctors.slice(0, 6).map((doc) => (
                <div
                  key={doc.id}
                  className="flex items-center justify-between rounded-lg border border-slate-200 p-3"
                >
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium text-primary-950">{doc.name}</p>
                    <p className="text-xs text-slate-500">
                      {doc.specialty} • {doc.department}
                    </p>
                  </div>
                  <HospitalStatusBadge status={doc.availability} size="sm" />
                </div>
              ))}
            </div>
          </SectionCard>

          <SectionCard
            title="Healthcare Services"
            description="Services and availability recorded for this hospital."
            actions={
              <Button variant="ghost" size="sm" className="gap-1.5" asChild>
                <Link href="/hospital/services">
                  Manage services
                  <ArrowRight className="h-3.5 w-3.5" aria-hidden />
                </Link>
              </Button>
            }
          >
            <div className="grid grid-cols-2 gap-2">
              <Card className="border-slate-200">
                <CardContent className="p-3">
                  <p className="text-[11px] uppercase tracking-wide text-slate-500">Available</p>
                  <p className="text-xl font-bold tabular-nums text-india-600">{svcCounts.available}</p>
                </CardContent>
              </Card>
              <Card className="border-slate-200">
                <CardContent className="p-3">
                  <p className="text-[11px] uppercase tracking-wide text-slate-500">Limited</p>
                  <p className="text-xl font-bold tabular-nums text-saffron-700">{svcCounts.limited}</p>
                </CardContent>
              </Card>
            </div>
            <div className="mt-3 flex flex-wrap gap-1.5">
              {services.slice(0, 8).map((service) => (
                <span
                  key={service.id}
                  className={cn(
                    "inline-flex items-center gap-1 rounded-full px-2 py-1 text-[11px]",
                    service.status === "AVAILABLE"
                      ? "bg-india-50 text-india-700"
                      : "bg-saffron-50 text-saffron-700"
                  )}
                >
                  <HeartPulse className="h-3 w-3" aria-hidden />
                  {service.name}
                </span>
              ))}
            </div>
          </SectionCard>

          <SectionCard
            title="Recent Hospital Activity"
            description="Recent changes made to this hospital's saved records."
          >
            <div className="space-y-2">
              {activity.slice(0, 5).map((item) => (
                <div key={item.id} className="flex items-start gap-2.5">
                  <span
                    className={cn(
                      "mt-1.5 h-1.5 w-1.5 rounded-full",
                      item.tone === "red" && "bg-red-500",
                      item.tone === "amber" && "bg-saffron-500",
                      item.tone === "green" && "bg-emerald-500",
                      item.tone === "blue" && "bg-primary-600"
                    )}
                    aria-hidden
                  />
                  <div className="min-w-0 flex-1">
                    <p className="text-sm leading-relaxed text-primary-950">{item.message}</p>
                    <p className="text-xs text-slate-500">
                      {item.detail} • {timeAgo(item.at)}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </SectionCard>

          <Card className="shadow-card">
            <CardContent className="p-4">
              <p className="text-sm font-semibold text-primary-950">Quick Actions</p>
              <p className="mt-0.5 text-xs text-slate-500">
                Shortcuts to hospital record management.
              </p>
              <div className="mt-3 grid grid-cols-2 gap-2">
                {quickActions.map((action) => {
                  const Icon = action.icon;
                  return (
                    <Link
                      key={action.href}
                      href={action.href}
                      className="flex items-center gap-2 rounded-lg border border-slate-200 px-3 py-2 text-sm text-primary-900 transition-colors hover:bg-primary-50"
                    >
                      <Icon className="h-4 w-4 text-care-600" aria-hidden />
                      {action.label}
                    </Link>
                  );
                })}
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
