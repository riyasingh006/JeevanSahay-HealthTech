"use client";

import * as React from "react";
import { ClipboardList, Download, Search } from "lucide-react";
import { AdminError, AdminPagination, adminRequest, downloadCsv, formatAdminDate, useAdminResource } from "@/components/admin/admin-ui";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { useToast } from "@/components/ui/toast";

type ReportStatus = "OPEN" | "IN_REVIEW" | "RESOLVED" | "DISMISSED";
type Report = {
  id: string;
  category: string;
  subject: string;
  message: string;
  reporterName: string | null;
  contactEmail: string | null;
  relatedHospital: string | null;
  status: ReportStatus;
  resolutionNote: string | null;
  createdAt: string;
  resolvedAt: string | null;
};
type ReportResponse = { reports: Report[]; total: number; page: number; pageSize: number };

const statuses: Array<"ALL" | ReportStatus> = ["ALL", "OPEN", "IN_REVIEW", "RESOLVED", "DISMISSED"];
const transitions: Record<ReportStatus, ReportStatus[]> = {
  OPEN: ["IN_REVIEW", "RESOLVED", "DISMISSED"],
  IN_REVIEW: ["OPEN", "RESOLVED", "DISMISSED"],
  RESOLVED: ["OPEN"],
  DISMISSED: ["OPEN"],
};
const pageSize = 50;

export default function AdminReportsPage() {
  const { toast } = useToast();
  const [draft, setDraft] = React.useState("");
  const [query, setQuery] = React.useState("");
  const [status, setStatus] = React.useState<"ALL" | ReportStatus>("OPEN");
  const [page, setPage] = React.useState(1);
  const [target, setTarget] = React.useState<Report | null>(null);
  const [nextStatus, setNextStatus] = React.useState<ReportStatus>("IN_REVIEW");
  const [note, setNote] = React.useState("");
  const [saving, setSaving] = React.useState(false);
  const params = new URLSearchParams({ status, page: String(page), pageSize: String(pageSize) });
  if (query) params.set("q", query);
  const resource = useAdminResource<ReportResponse>(`/api/admin/reports?${params.toString()}`);
  const reports = resource.data?.reports ?? [];

  function applySearch(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setQuery(draft.trim());
    setPage(1);
  }

  function openReview(report: Report) {
    setTarget(report);
    setNextStatus(report.status === "OPEN" ? "IN_REVIEW" : report.status === "IN_REVIEW" ? "RESOLVED" : "OPEN");
    setNote("");
  }

  async function saveReview() {
    if (!target) return;
    if ((nextStatus === "RESOLVED" || nextStatus === "DISMISSED") && note.trim().length < 8) {
      toast({ title: "Add a resolution note", description: "Use at least 8 characters before closing this report.", variant: "error" });
      return;
    }
    setSaving(true);
    try {
      await adminRequest<{ report: Report }>("/api/admin/reports", {
        method: "PATCH",
        body: JSON.stringify({ reportId: target.id, expectedStatus: target.status, status: nextStatus, resolutionNote: note.trim() || undefined }),
      });
      toast({ title: "Report updated", description: `Status changed to ${nextStatus.replaceAll("_", " ")}. The decision was recorded in the audit trail.`, variant: "success" });
      setTarget(null);
      await resource.refresh();
    } catch (cause) {
      toast({ title: "Report was not updated", description: cause instanceof Error ? cause.message : "The request could not be completed.", variant: "error" });
      await resource.refresh();
    } finally {
      setSaving(false);
    }
  }

  function exportPage() {
    downloadCsv(`reports-page-${page}-${new Date().toISOString().slice(0, 10)}.csv`, ["Subject", "Category", "Status", "Reporter", "Contact email", "Related hospital", "Message", "Resolution note", "Submitted"], reports.map((report) => [report.subject, report.category, report.status, report.reporterName ?? "", report.contactEmail ?? "", report.relatedHospital ?? "", report.message, report.resolutionNote ?? "", report.createdAt]));
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div><p className="text-xs font-semibold uppercase tracking-[0.15em] text-saffron-700">Platform administration</p><h1 className="mt-1 text-3xl font-bold tracking-tight text-primary-950">Reports & complaints</h1><p className="mt-2 max-w-3xl text-sm text-slate-600">Review user-submitted issues, track status changes, and leave a clear note when closing a report.</p></div>
        <Button variant="secondary" size="sm" onClick={exportPage} disabled={reports.length === 0}><Download className="mr-2 h-4 w-4" aria-hidden />Export current page</Button>
      </div>
      {resource.error && <AdminError message={resource.error} retry={() => void resource.refresh()} />}
      <Card>
        <CardHeader><CardTitle>Report queue</CardTitle><CardDescription>{resource.data ? `${resource.data.total} reports match these filters.` : "Reports are loaded from the protected database."} Exports include the current filtered page.</CardDescription></CardHeader>
        <CardContent className="space-y-4">
          <form onSubmit={applySearch} className="grid gap-3 sm:grid-cols-[minmax(220px,1fr)_220px_auto]">
            <label className="relative"><span className="sr-only">Search reports</span><Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" aria-hidden /><Input className="pl-9" value={draft} onChange={(event) => setDraft(event.target.value)} placeholder="Subject, message, reporter, hospital" /></label>
            <label className="sr-only" htmlFor="report-status">Report status</label><select id="report-status" value={status} onChange={(event) => { setStatus(event.target.value as "ALL" | ReportStatus); setPage(1); }} className="h-10 rounded-md border border-slate-300 bg-white px-3 text-sm text-slate-800">{statuses.map((item) => <option key={item} value={item}>{item === "ALL" ? "All statuses" : item.replaceAll("_", " ")}</option>)}</select>
            <Button type="submit">Apply filters</Button>
          </form>
          {resource.loading && !resource.data ? <p role="status" className="py-8 text-center text-sm text-slate-500">Loading reports…</p> : reports.length === 0 ? <div className="rounded-lg border border-dashed border-slate-300 px-4 py-12 text-center"><ClipboardList className="mx-auto h-8 w-8 text-slate-400" aria-hidden /><p className="mt-3 font-medium text-primary-950">No reports in this view</p><p className="mt-1 text-sm text-slate-500">Try another status or search.</p></div> : <>
            <div className="overflow-x-auto rounded-lg border border-slate-200">
              <table className="w-full min-w-[820px] text-left text-sm">
                <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500"><tr><th className="px-4 py-3 font-semibold">Report</th><th className="px-4 py-3 font-semibold">Reporter</th><th className="px-4 py-3 font-semibold">Status</th><th className="px-4 py-3 font-semibold">Submitted</th><th className="px-4 py-3 font-semibold">Review</th></tr></thead>
                <tbody className="divide-y divide-slate-100">
                  {reports.map((report) => <tr key={report.id} className="align-top hover:bg-slate-50/70">
                    <td className="px-4 py-4"><p className="font-semibold text-primary-950">{report.subject}</p><p className="mt-1 line-clamp-2 max-w-xl text-slate-600">{report.message}</p><p className="mt-1 text-xs text-slate-500">{report.category.replaceAll("_", " ")}{report.relatedHospital ? ` · ${report.relatedHospital}` : ""}</p></td>
                    <td className="px-4 py-4"><p className="text-slate-800">{report.reporterName || "Not provided"}</p><p className="text-xs text-slate-500">{report.contactEmail || "No contact email"}</p></td>
                    <td className="px-4 py-4"><span className={`inline-flex rounded-full px-2.5 py-1 text-xs font-semibold ${report.status === "OPEN" ? "bg-amber-50 text-amber-800" : report.status === "IN_REVIEW" ? "bg-blue-50 text-blue-800" : report.status === "RESOLVED" ? "bg-green-50 text-green-800" : "bg-slate-100 text-slate-700"}`}>{report.status.replaceAll("_", " ")}</span></td>
                    <td className="px-4 py-4 whitespace-nowrap text-slate-600">{formatAdminDate(report.createdAt)}</td>
                    <td className="px-4 py-4"><Button variant="secondary" size="sm" onClick={() => openReview(report)}>Review</Button></td>
                  </tr>)}
                </tbody>
              </table>
            </div>
            {resource.data && <AdminPagination page={resource.data.page} pageSize={resource.data.pageSize} total={resource.data.total} onPage={setPage} />}
          </>}
        </CardContent>
      </Card>
      <Dialog open={!!target} onOpenChange={(open) => { if (!open && !saving) setTarget(null); }}>
        <DialogContent className="max-h-[90vh] max-w-2xl overflow-y-auto">
          <DialogHeader><DialogTitle>{target?.subject}</DialogTitle><DialogDescription>{target ? `${target.category.replaceAll("_", " ")} · submitted ${formatAdminDate(target.createdAt)}` : "Review report details and record an action."}</DialogDescription></DialogHeader>
          {target && <div className="space-y-4">
            <div className="rounded-lg bg-slate-50 p-4"><p className="whitespace-pre-wrap text-sm leading-6 text-slate-800">{target.message}</p><div className="mt-3 border-t border-slate-200 pt-3 text-xs text-slate-600">Reporter: {target.reporterName || "Not provided"} · {target.contactEmail || "No contact email"}{target.relatedHospital ? ` · ${target.relatedHospital}` : ""}</div></div>
            {target.resolutionNote && <div className="rounded-lg border border-green-200 bg-green-50 p-3 text-sm text-green-900"><strong>Previous resolution note:</strong> {target.resolutionNote}</div>}
            <div className="grid gap-3 sm:grid-cols-2"><label className="space-y-1.5 text-sm font-medium text-slate-700" htmlFor="next-report-status">New status<select id="next-report-status" value={nextStatus} onChange={(event) => setNextStatus(event.target.value as ReportStatus)} className="h-10 w-full rounded-md border border-slate-300 bg-white px-3 text-sm">{transitions[target.status].map((item) => <option key={item} value={item}>{item.replaceAll("_", " ")}</option>)}</select></label><label className="space-y-1.5 text-sm font-medium text-slate-700" htmlFor="resolution-note">Resolution note {(nextStatus === "RESOLVED" || nextStatus === "DISMISSED") && <span className="text-red-700">(required)</span>}<textarea id="resolution-note" value={note} onChange={(event) => setNote(event.target.value)} maxLength={400} className="min-h-24 w-full rounded-md border border-slate-300 px-3 py-2 text-sm font-normal focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500" placeholder="Record the action taken or why this report was dismissed." /></label></div>
            <div className="flex justify-end gap-2 border-t border-slate-100 pt-4"><Button variant="secondary" onClick={() => setTarget(null)} disabled={saving}>Cancel</Button><Button onClick={() => void saveReview()} disabled={saving || (nextStatus === "RESOLVED" || nextStatus === "DISMISSED") && note.trim().length < 8}>{saving ? "Saving…" : "Save review"}</Button></div>
          </div>}
        </DialogContent>
      </Dialog>
    </div>
  );
}
