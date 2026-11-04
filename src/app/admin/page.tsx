"use client";

import Link from "next/link";
import { Activity, ArrowRight, Building2, ClipboardList, Hospital, Search, Users } from "lucide-react";
import { AdminError, formatAdminDate, useAdminResource } from "@/components/admin/admin-ui";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

type QueueItem = {
  id: string;
  applicationId?: string;
  hospitalId?: string;
  type: "APPLICATION" | "HOSPITAL";
  name: string;
  city: string;
  hospitalType: string;
  status: string;
  email: string;
  emailVerified: boolean;
  createdAt: string;
};

type AuditItem = {
  id: string;
  actorEmail: string | null;
  actor?: { name: string } | null;
  action: string;
  entityType: string | null;
  createdAt: string;
};

type AdminOverview = {
  stats: {
    registeredUsers: number;
    verifiedHospitals: number;
    pendingHospitals: number;
    totalBeds: number;
    availableBeds: number;
    activeSpecialists: number;
    emergencySearches: number;
    openReports: number;
  };
  queue: QueueItem[];
  auditTrail: AuditItem[];
};

const statCards = [
  { key: "registeredUsers", label: "Registered accounts", icon: Users, tone: "text-blue-700 bg-blue-50" },
  { key: "verifiedHospitals", label: "Verified hospitals", icon: Building2, tone: "text-green-700 bg-green-50" },
  { key: "pendingHospitals", label: "Applications to review", icon: Hospital, tone: "text-amber-700 bg-amber-50" },
  { key: "openReports", label: "Open reports", icon: ClipboardList, tone: "text-red-700 bg-red-50" },
] as const;

export default function AdminOverviewPage() {
  const { data, loading, error, refresh } = useAdminResource<AdminOverview>("/api/admin/stats");

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.15em] text-saffron-700">Platform administration</p>
          <h1 className="mt-1 text-3xl font-bold tracking-tight text-primary-950">Overview</h1>
          <p className="mt-2 max-w-2xl text-sm text-slate-600">Review hospital applications, monitor platform accounts, and follow recent audited changes.</p>
        </div>
        <Link href="/admin/audit" className="inline-flex items-center gap-2 text-sm font-semibold text-primary-700 hover:text-primary-900">View audit trail <ArrowRight className="h-4 w-4" aria-hidden /></Link>
      </div>

      {error && <AdminError message={error} retry={() => void refresh()} />}

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {statCards.map((item) => {
          const Icon = item.icon;
          return <Card key={item.key} className="border-slate-200 shadow-sm"><CardContent className="flex items-center gap-4 p-5"><span className={`grid h-11 w-11 place-items-center rounded-xl ${item.tone}`}><Icon className="h-5 w-5" aria-hidden /></span><div><p className="text-sm text-slate-600">{item.label}</p><p className="mt-1 text-2xl font-bold tabular-nums text-primary-950">{loading && !data ? "—" : data?.stats[item.key] ?? 0}</p></div></CardContent></Card>;
        })}
      </div>

      <Card>
        <CardHeader><CardTitle>Operational activity</CardTitle><CardDescription>Current database records across verified hospitals; emergency search count covers the last 7 days.</CardDescription></CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-3">
          <div><p className="text-sm text-slate-600">Reported available beds</p><p className="mt-1 text-2xl font-bold tabular-nums text-primary-950">{loading && !data ? "—" : data?.stats.availableBeds ?? 0}</p><p className="mt-1 text-xs text-slate-500">of {loading && !data ? "—" : data?.stats.totalBeds ?? 0} recorded total</p></div>
          <div><p className="text-sm text-slate-600">Available specialists</p><p className="mt-1 text-2xl font-bold tabular-nums text-primary-950">{loading && !data ? "—" : data?.stats.activeSpecialists ?? 0}</p><p className="mt-1 text-xs text-slate-500">Marked available in verified hospitals</p></div>
          <div><p className="text-sm text-slate-600">Emergency searches · 7 days</p><p className="mt-1 text-2xl font-bold tabular-nums text-primary-950">{loading && !data ? "—" : data?.stats.emergencySearches ?? 0}</p><p className="mt-1 text-xs text-slate-500">Recorded search activity, not emergency dispatches</p></div>
        </CardContent>
      </Card>

      <div className="grid gap-5 xl:grid-cols-5">
        <Card className="xl:col-span-3">
          <CardHeader className="flex flex-row items-start justify-between gap-3"><div><CardTitle>Review queue</CardTitle><CardDescription>Pending applications and legacy hospital records that still need a decision.</CardDescription></div><Link href="/admin/hospitals" className="text-sm font-semibold text-primary-700 hover:underline">Open queue</Link></CardHeader>
          <CardContent>
            {loading && !data ? <p role="status" className="py-8 text-center text-sm text-slate-500">Loading review queue…</p> : (data?.queue.length ?? 0) === 0 ? <p className="py-8 text-center text-sm text-slate-500">No hospital reviews are waiting.</p> : (
              <div className="divide-y divide-slate-100">
                {data?.queue.slice(0, 6).map((item) => <Link key={`${item.type}-${item.id}`} href="/admin/hospitals" className="flex flex-wrap items-center justify-between gap-3 py-3 first:pt-0 last:pb-0 hover:bg-slate-50/70">
                  <span><span className="block font-medium text-primary-950">{item.name}</span><span className="mt-0.5 block text-xs text-slate-500">{item.city} · {item.type === "APPLICATION" ? "Application" : "Hospital record"}{item.email && ` · ${item.email}`}</span></span>
                  <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${item.emailVerified ? "bg-amber-50 text-amber-800" : "bg-red-50 text-red-800"}`}>{item.emailVerified ? "Needs review" : "Email not verified"}</span>
                </Link>)}
              </div>
            )}
          </CardContent>
        </Card>

        <Card className="xl:col-span-2">
          <CardHeader><CardTitle>Recent audit activity</CardTitle><CardDescription>Latest privileged actions recorded by the platform.</CardDescription></CardHeader>
          <CardContent>
            {loading && !data ? <p role="status" className="py-8 text-center text-sm text-slate-500">Loading audit activity…</p> : (data?.auditTrail.length ?? 0) === 0 ? <p className="py-8 text-center text-sm text-slate-500">No audit events recorded yet.</p> : <div className="space-y-4">{data?.auditTrail.slice(0, 6).map((entry) => <div key={entry.id} className="flex gap-3"><span className="mt-1 grid h-8 w-8 shrink-0 place-items-center rounded-full bg-slate-100 text-slate-700"><Activity className="h-4 w-4" aria-hidden /></span><div className="min-w-0"><p className="text-sm font-medium text-primary-950">{entry.action.replaceAll("_", " ")}</p><p className="truncate text-xs text-slate-500">{entry.actor?.name ?? entry.actorEmail ?? "System"} · {entry.entityType ?? "Record"}</p><p className="mt-0.5 text-xs text-slate-400">{formatAdminDate(entry.createdAt)}</p></div></div>)}</div>}
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <Link href="/admin/hospitals" className="group rounded-xl border border-slate-200 bg-white p-5 shadow-sm transition hover:border-primary-300 hover:shadow-card"><Building2 className="h-5 w-5 text-primary-700" aria-hidden /><p className="mt-3 font-semibold text-primary-950">Hospital verification</p><p className="mt-1 text-sm text-slate-600">Review application details and supporting status before approval.</p></Link>
        <Link href="/admin/users" className="group rounded-xl border border-slate-200 bg-white p-5 shadow-sm transition hover:border-primary-300 hover:shadow-card"><Users className="h-5 w-5 text-primary-700" aria-hidden /><p className="mt-3 font-semibold text-primary-950">Account management</p><p className="mt-1 text-sm text-slate-600">Search accounts and suspend or reactivate access.</p></Link>
        <Link href="/admin/reports" className="group rounded-xl border border-slate-200 bg-white p-5 shadow-sm transition hover:border-primary-300 hover:shadow-card"><Search className="h-5 w-5 text-primary-700" aria-hidden /><p className="mt-3 font-semibold text-primary-950">Reports and complaints</p><p className="mt-1 text-sm text-slate-600">Review user-submitted reports and record a resolution.</p></Link>
      </div>
      {loading && !data && <p className="sr-only">Loading administrative summary.</p>}
    </div>
  );
}
