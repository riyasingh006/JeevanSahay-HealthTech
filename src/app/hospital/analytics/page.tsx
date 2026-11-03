"use client";

import * as React from "react";
import { BarChart3, FileText, Printer } from "lucide-react";
import { useHospitalPortal } from "@/components/hospital/hospital-store";
import {
  LiveRecordsNotice,
  LegendDot,
  NativeSelect,
  PageHeader,
  ProgressBar,
  SectionCard,
  StatCard,
  TrendChart,
} from "@/components/hospital/hospital-ui";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  appointmentStatusCounts,
  availableBedsByType,
  bedInventoryCounts,
  bedInventoryByType,
  departmentBedSummary,
  doctorAvailabilityCounts,
  emergencySummary,
  serviceStatusCounts,
} from "@/lib/hospital/hospital-data";

export default function HospitalAnalyticsPage() {
  const { beds, bedInventory, doctors, departments, emergencyCases, services, appointments, trend } =
    useHospitalPortal();
  const [range, setRange] = React.useState("30");

  const bedCount = bedInventoryCounts(bedInventory, beds);
  const byType = bedInventoryByType(bedInventory, beds);
  const docCounts = doctorAvailabilityCounts(doctors);
  const deptSummary = departmentBedSummary(beds, departments);
  const svcCounts = serviceStatusCounts(services);
  const aptCounts = appointmentStatusCounts(appointments);
  const erSummary = emergencySummary(emergencyCases);
  const icuAvailable = availableBedsByType(bedInventory, beds, "ICU");
  const occupancy = bedCount.total ? Math.round((bedCount.occupied / bedCount.total) * 100) : 0;

  const trendData = React.useMemo(() => {
    const limit = Number(range);
    return trend.slice(Math.max(0, trend.length - limit));
  }, [range, trend]);

  function printReport() {
    window.print();
  }

  return (
    <div className="space-y-6 print:text-black">
      <PageHeader
        eyebrow="Hospital Management"
        title="Analytics & Reports"
        description="All calculations are derived from the centralized live dataset."
        icon={BarChart3}
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <NativeSelect value={range} onChange={(e) => setRange(e.target.value)} className="h-9 w-40">
              <option value="7">Last 7 days</option>
              <option value="14">Last 14 days</option>
              <option value="30">Last 30 days</option>
            </NativeSelect>
            <Button variant="secondary" size="sm" className="gap-1.5" onClick={printReport}>
              <Printer className="h-3.5 w-3.5" aria-hidden />
              Print Report
            </Button>
            <Button size="sm" className="gap-1.5">
              <FileText className="h-3.5 w-3.5" aria-hidden />
              Export Summary
            </Button>
          </div>
        }
      />

      <LiveRecordsNotice>
        Charts and percentages are computed from live data. The print-friendly
        report uses the browser print stylesheet.
      </LiveRecordsNotice>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="Bed Occupancy" value={`${occupancy}%`} hint={`${bedCount.occupied}/${bedCount.total} occupied`} icon={BarChart3} tone={occupancy >= 85 ? "red" : occupancy >= 65 ? "amber" : "green"} />
        <StatCard label="Available Beds" value={bedCount.available} hint={`${bedCount.reserved} reserved`} icon={BarChart3} tone="green" />
        <StatCard label="Available ICU" value={icuAvailable} hint="Critical care capacity" icon={BarChart3} tone="red" />
        <StatCard label="Doctors Available" value={docCounts.available} hint={`${docCounts.total} total`} icon={BarChart3} tone="violet" />
        <StatCard label="Appointments" value={aptCounts.total} hint={`${aptCounts.requested} requested • ${aptCounts.confirmed} confirmed`} icon={BarChart3} tone="blue" />
        <StatCard label="Completed" value={aptCounts.completed} hint={`${aptCounts.cancelled + aptCounts.noShow} missed/cancelled`} icon={BarChart3} tone="green" />
        <StatCard label="Active Emergencies" value={erSummary.active} hint={`${erSummary.critical} critical`} icon={BarChart3} tone="red" />
        <StatCard label="Services Available" value={svcCounts.available} hint={`${svcCounts.limited} limited`} icon={BarChart3} tone="teal" />
      </div>

      <div className="grid gap-6 xl:grid-cols-12">
        <div className="xl:col-span-8">
          <SectionCard
            title="Emergency Reports & Appointment Requests"
            description="Daily emergency reports and appointment requests recorded by your hospital over the selected period."
          >
            <TrendChart
              data={trendData}
              series={[
                { key: "emergency", label: "Emergency reports" },
                { key: "appointments", label: "Appointment requests" },
              ]}
            />
          </SectionCard>
        </div>
        <div className="xl:col-span-4">
          <SectionCard title="Bed Availability vs Occupied" description="Current snapshot">
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <LegendDot color="bg-india-500" label="Available" value={bedCount.available} />
                <LegendDot color="bg-primary-600" label="Occupied" value={bedCount.occupied} />
              </div>
              <ProgressBar value={occupancy} tone={occupancy >= 85 ? "red" : "blue"} />
              <div className="space-y-2">
                {byType.map((entry) => (
                  <div key={entry.bedType} className="flex items-center justify-between text-xs">
                    <span className="text-slate-600">{entry.bedType}</span>
                    <span className="tabular-nums text-primary-900">{entry.available} / {entry.total}</span>
                  </div>
                ))}
              </div>
            </div>
          </SectionCard>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <SectionCard title="Department-wise Bed Utilization" description="Utilization derived from bed records per department">
          <div className="space-y-2">
            {deptSummary.map((dept) => (
              <div key={dept.id} className="flex items-center gap-3">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center justify-between">
                    <p className="truncate text-sm font-medium text-primary-950">{dept.name}</p>
                    <p className="text-xs tabular-nums text-slate-500">{dept.occupiedBeds}/{dept.totalBeds} • {dept.utilization}%</p>
                  </div>
                  <div className="mt-1.5">
                    <ProgressBar value={dept.utilization} tone={dept.utilization >= 85 ? "red" : dept.utilization >= 65 ? "amber" : "green"} />
                  </div>
                </div>
              </div>
            ))}
          </div>
        </SectionCard>
        <SectionCard title="Doctor Availability Summary" description="Counts from live roster">
          <div className="grid grid-cols-2 gap-2">
            <Card className="border-slate-200"><CardContent className="p-3"><p className="text-[11px] uppercase tracking-wide text-slate-500">Available</p><p className="text-xl font-bold text-india-600">{docCounts.available}</p></CardContent></Card>
            <Card className="border-slate-200"><CardContent className="p-3"><p className="text-[11px] uppercase tracking-wide text-slate-500">Limited</p><p className="text-xl font-bold text-saffron-700">{docCounts.limited}</p></CardContent></Card>
            <Card className="border-slate-200"><CardContent className="p-3"><p className="text-[11px] uppercase tracking-wide text-slate-500">Unavailable</p><p className="text-xl font-bold text-slate-600">{docCounts.unavailable}</p></CardContent></Card>
            <Card className="border-slate-200"><CardContent className="p-3"><p className="text-[11px] uppercase tracking-wide text-slate-500">Total</p><p className="text-xl font-bold text-primary-950">{docCounts.total}</p></CardContent></Card>
          </div>
          <div className="mt-4 space-y-2">
            {appointments.slice(0, 6).map((apt) => (
              <div key={apt.id} className="flex items-center justify-between rounded-lg border border-slate-200 px-3 py-2">
                <div>
                  <p className="text-sm text-primary-950">{apt.doctorName}</p>
                  <p className="text-xs text-slate-500">{apt.department} • {apt.date} {apt.time}</p>
                </div>
                <span className="text-xs text-slate-500">{apt.status}</span>
              </div>
            ))}
          </div>
        </SectionCard>
      </div>

      <SectionCard title="Emergency Case Trends" description="live distribution by severity and current status">
        <div className="grid gap-3 md:grid-cols-4">
          <Card className="border-slate-200"><CardContent className="p-3"><p className="text-[11px] uppercase tracking-wide text-slate-500">Critical</p><p className="text-xl font-bold text-red-700">{emergencyCases.filter((e) => e.severity === "CRITICAL").length}</p></CardContent></Card>
          <Card className="border-slate-200"><CardContent className="p-3"><p className="text-[11px] uppercase tracking-wide text-slate-500">Urgent</p><p className="text-xl font-bold text-saffron-700">{emergencyCases.filter((e) => e.severity === "URGENT").length}</p></CardContent></Card>
          <Card className="border-slate-200"><CardContent className="p-3"><p className="text-[11px] uppercase tracking-wide text-slate-500">Moderate</p><p className="text-xl font-bold text-primary-700">{emergencyCases.filter((e) => e.severity === "MODERATE").length}</p></CardContent></Card>
          <Card className="border-slate-200"><CardContent className="p-3"><p className="text-[11px] uppercase tracking-wide text-slate-500">Discharged</p><p className="text-xl font-bold text-india-600">{emergencyCases.filter((e) => e.status === "DISCHARGED").length}</p></CardContent></Card>
        </div>
      </SectionCard>
    </div>
  );
}
