"use client";

import * as React from "react";
import { Activity, Download, Search } from "lucide-react";
import { AdminError, AdminPagination, downloadCsv, formatAdminDate, useAdminResource } from "@/components/admin/admin-ui";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";

type AuditEntry = {
  id: string;
  actorUserId: string | null;
  actorEmail: string | null;
  actor: { name: string } | null;
  action: string;
  entityType: string | null;
  entityId: string | null;
  meta: string | null;
  ip: string | null;
  createdAt: string;
};
type AuditResponse = { entries: AuditEntry[]; total: number; page: number; pageSize: number };
type Filters = { q: string; action: string; from: string; to: string };
const pageSize = 50;

function localDayStart(value: string) {
  return new Date(`${value}T00:00:00+05:30`).toISOString();
}

function localDayEnd(value: string) {
  return new Date(`${value}T23:59:59.999+05:30`).toISOString();
}

function readableMeta(value: string | null) {
  if (!value) return "—";
  try { return JSON.stringify(JSON.parse(value), null, 2); } catch { return value; }
}

export default function AdminAuditPage() {
  const [draft, setDraft] = React.useState<Filters>({ q: "", action: "", from: "", to: "" });
  const [filters, setFilters] = React.useState<Filters>({ q: "", action: "", from: "", to: "" });
  const [page, setPage] = React.useState(1);
  const [dateError, setDateError] = React.useState("");
  const params = new URLSearchParams({ page: String(page), q: filters.q, action: filters.action, pageSize: String(pageSize) });
  if (filters.from) params.set("from", localDayStart(filters.from));
  if (filters.to) params.set("to", localDayEnd(filters.to));
  const resource = useAdminResource<AuditResponse>(`/api/admin/audit?${params.toString()}`);
  const entries = resource.data?.entries ?? [];

  function applyFilters(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (draft.from && draft.to && draft.from > draft.to) {
      setDateError("The start date must be before or the same as the end date.");
      return;
    }
    setDateError("");
    setFilters({ ...draft, q: draft.q.trim(), action: draft.action.trim() });
    setPage(1);
  }

  function exportPage() {
    downloadCsv(`audit-trail-page-${page}-${new Date().toISOString().slice(0, 10)}.csv`, ["Timestamp", "Actor", "Action", "Entity", "Entity ID", "IP address", "Metadata"], entries.map((entry) => [entry.createdAt, entry.actor?.name ?? entry.actorEmail ?? "System", entry.action, entry.entityType ?? "", entry.entityId ?? "", entry.ip ?? "", entry.meta ?? ""]));
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div><p className="text-xs font-semibold uppercase tracking-[0.15em] text-saffron-700">Platform administration</p><h1 className="mt-1 text-3xl font-bold tracking-tight text-primary-950">Audit trail</h1><p className="mt-2 max-w-3xl text-sm text-slate-600">Read-only record of privileged account, hospital, report, and security actions. Times are shown in Asia/Kolkata.</p></div>
        <Button variant="secondary" size="sm" onClick={exportPage} disabled={entries.length === 0}><Download className="mr-2 h-4 w-4" aria-hidden />Export current page</Button>
      </div>
      {resource.error && <AdminError message={resource.error} retry={() => void resource.refresh()} />}
      <Card>
        <CardHeader><CardTitle>Recorded actions</CardTitle><CardDescription>{resource.data ? `${resource.data.total} events match these filters.` : "Audit events are loaded from the protected database."} Exports include the current filtered page.</CardDescription></CardHeader>
        <CardContent className="space-y-4">
          <form onSubmit={applyFilters} className="grid gap-3 md:grid-cols-2 xl:grid-cols-[minmax(200px,1fr)_minmax(160px,0.8fr)_150px_150px_auto]">
            <label className="relative"><span className="sr-only">Search audit events</span><Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" aria-hidden /><Input className="pl-9" value={draft.q} onChange={(event) => setDraft((current) => ({ ...current, q: event.target.value }))} placeholder="Actor, action, entity, ID" /></label>
            <label className="sr-only" htmlFor="audit-action">Action contains</label><Input id="audit-action" value={draft.action} onChange={(event) => setDraft((current) => ({ ...current, action: event.target.value }))} placeholder="Action filter" />
            <label className="sr-only" htmlFor="audit-from">From date</label><Input id="audit-from" type="date" value={draft.from} onChange={(event) => setDraft((current) => ({ ...current, from: event.target.value }))} />
            <label className="sr-only" htmlFor="audit-to">To date</label><Input id="audit-to" type="date" value={draft.to} onChange={(event) => setDraft((current) => ({ ...current, to: event.target.value }))} />
            <Button type="submit">Apply filters</Button>
          </form>
          {dateError && <p role="alert" className="text-sm text-red-700">{dateError}</p>}
          {resource.loading && !resource.data ? <p role="status" className="py-8 text-center text-sm text-slate-500">Loading audit events…</p> : entries.length === 0 ? <div className="rounded-lg border border-dashed border-slate-300 px-4 py-12 text-center"><Activity className="mx-auto h-8 w-8 text-slate-400" aria-hidden /><p className="mt-3 font-medium text-primary-950">No audit events in this view</p><p className="mt-1 text-sm text-slate-500">Try another search or date range.</p></div> : <>
            <div className="overflow-x-auto rounded-lg border border-slate-200">
              <table className="w-full min-w-[850px] text-left text-sm">
                <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500"><tr><th className="px-4 py-3 font-semibold">Time</th><th className="px-4 py-3 font-semibold">Actor</th><th className="px-4 py-3 font-semibold">Action</th><th className="px-4 py-3 font-semibold">Record</th><th className="px-4 py-3 font-semibold">Network</th></tr></thead>
                <tbody className="divide-y divide-slate-100">
                  {entries.map((entry) => <tr key={entry.id} className="align-top hover:bg-slate-50/70">
                    <td className="whitespace-nowrap px-4 py-4 text-slate-600">{formatAdminDate(entry.createdAt)}</td>
                    <td className="px-4 py-4"><p className="font-medium text-primary-950">{entry.actor?.name ?? "System"}</p><p className="text-xs text-slate-500">{entry.actorEmail ?? "No actor email"}</p></td>
                    <td className="px-4 py-4"><span className="inline-flex rounded-full bg-blue-50 px-2.5 py-1 text-xs font-semibold text-blue-800">{entry.action.replaceAll("_", " ")}</span></td>
                    <td className="px-4 py-4"><p className="font-medium text-slate-800">{entry.entityType ?? "—"}</p><p className="break-all text-xs text-slate-500">{entry.entityId ?? "—"}</p>{entry.meta && <details className="mt-2 max-w-sm"><summary className="cursor-pointer text-xs font-medium text-primary-700">Event details</summary><pre className="mt-2 max-h-48 overflow-auto whitespace-pre-wrap break-words rounded bg-slate-50 p-2 text-xs text-slate-600">{readableMeta(entry.meta)}</pre></details>}</td>
                    <td className="px-4 py-4 text-slate-600">{entry.ip ?? "—"}</td>
                  </tr>)}
                </tbody>
              </table>
            </div>
            {resource.data && <AdminPagination page={resource.data.page} pageSize={resource.data.pageSize} total={resource.data.total} onPage={setPage} />}
          </>}
        </CardContent>
      </Card>
    </div>
  );
}
