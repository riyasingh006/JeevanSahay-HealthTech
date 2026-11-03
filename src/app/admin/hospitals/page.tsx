"use client";

import * as React from "react";
import { Building2, Check, Download, ExternalLink, MapPin, X } from "lucide-react";
import { AdminError, AdminPagination, adminRequest, downloadCsv, formatAdminDate, useAdminResource } from "@/components/admin/admin-ui";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/components/ui/toast";
import { DemoDataBadge } from "@/components/ui/data-source";

type Application = {
  id: string;
  hospitalName: string;
  registrationNumber: string | null;
  hospitalType: string;
  addressLine: string;
  city: string;
  state: string;
  pincode: string;
  phone: string;
  email: string;
  website: string | null;
  status: string;
  reviewNote: string | null;
  createdAt: string;
  reviewedAt: string | null;
  user: { id: string; name: string; email: string; phone: string | null; emailVerifiedAt: string | null; status: string };
};

type LegacyHospital = {
  id: string;
  name: string;
  type: string;
  status: string;
  registrationNumber: string | null;
  isDemo: boolean;
  addressLine: string;
  city: string;
  state: string;
  pincode: string;
  phone: string;
  email: string | null;
  rejectionReason: string | null;
  createdAt: string;
  beds: Array<{ category: string; total: number; available: number }>;
  _count: { doctors: number; services: number };
};

type StatusCounts = { PENDING_VERIFICATION: number; VERIFIED: number; REJECTED: number };
type ApplicationResponse = { applications: Application[]; total: number; page: number; pageSize: number; counts: StatusCounts };
type HospitalResponse = { hospitals: LegacyHospital[]; total: number; page: number; pageSize: number; counts: StatusCounts };
type GeocodeResult = { lat: number; lng: number; label: string };
type ReviewTarget = { kind: "application"; record: Application } | { kind: "hospital"; record: LegacyHospital };

const tabs = ["PENDING_VERIFICATION", "VERIFIED", "REJECTED"] as const;

export default function AdminHospitalsPage() {
  const { toast } = useToast();
  const [tab, setTab] = React.useState<(typeof tabs)[number]>("PENDING_VERIFICATION");
  const [queryDraft, setQueryDraft] = React.useState("");
  const [query, setQuery] = React.useState("");
  const [applicationPage, setApplicationPage] = React.useState(1);
  const [hospitalPage, setHospitalPage] = React.useState(1);
  const pageSize = 25;
  const applicationParams = new URLSearchParams({ status: tab, page: String(applicationPage), pageSize: String(pageSize) });
  const hospitalParams = new URLSearchParams({ status: tab, page: String(hospitalPage), pageSize: String(pageSize) });
  if (query) { applicationParams.set("q", query); hospitalParams.set("q", query); }
  const applications = useAdminResource<ApplicationResponse>(`/api/admin/applications?${applicationParams.toString()}`);
  const hospitals = useAdminResource<HospitalResponse>(`/api/admin/hospitals?${hospitalParams.toString()}`);
  const [target, setTarget] = React.useState<ReviewTarget | null>(null);
  const [decision, setDecision] = React.useState<"VERIFIED" | "REJECTED">("VERIFIED");
  const [reason, setReason] = React.useState("");
  const [location, setLocation] = React.useState<GeocodeResult | null>(null);
  const [locationLoading, setLocationLoading] = React.useState(false);
  const [locationError, setLocationError] = React.useState("");
  const [locationConfirmed, setLocationConfirmed] = React.useState(false);
  const [saving, setSaving] = React.useState(false);

  const appRows = applications.data?.applications ?? [];
  const hospitalRows = hospitals.data?.hospitals ?? [];
  const pendingCount = (applications.data?.counts.PENDING_VERIFICATION ?? 0) + (hospitals.data?.counts.PENDING_VERIFICATION ?? 0);
  const filteredApps = appRows;
  const filteredHospitals = hospitalRows;

  function applySearch(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setQuery(queryDraft.trim());
    setApplicationPage(1);
    setHospitalPage(1);
  }

  async function openReview(nextTarget: ReviewTarget, nextDecision: "VERIFIED" | "REJECTED") {
    setTarget(nextTarget);
    setDecision(nextDecision);
    setReason("");
    setLocation(null);
    setLocationError("");
    setLocationConfirmed(false);
    if (nextTarget.kind !== "application" || nextDecision !== "VERIFIED") return;
    if (!nextTarget.record.user.emailVerifiedAt) {
      setLocationError("The applicant must verify their email before approval.");
      return;
    }
    setLocationLoading(true);
    try {
      const address = `${nextTarget.record.addressLine}, ${nextTarget.record.city}, ${nextTarget.record.state} ${nextTarget.record.pincode}, India`;
      const result = await adminRequest<{ results: GeocodeResult[] }>(`/api/patient/geocode?q=${encodeURIComponent(address)}`);
      if (!result.results.length) throw new Error("No map result was found. Check the address before trying again.");
      setLocation(result.results[0]);
    } catch (cause) {
      setLocationError(cause instanceof Error ? cause.message : "Location could not be resolved.");
    } finally {
      setLocationLoading(false);
    }
  }

  async function submitReview() {
    if (!target) return;
    if (decision === "REJECTED" && reason.trim().length < 8) {
      toast({ title: "Add a clear rejection reason", description: "Use at least 8 characters so the applicant understands the decision.", variant: "error" });
      return;
    }
    if (target.kind === "application" && decision === "VERIFIED" && (!location || !locationConfirmed)) {
      toast({ title: "Confirm the map location", description: "A verified map location is required before approving an application.", variant: "error" });
      return;
    }
    setSaving(true);
    try {
      if (target.kind === "application") {
        const result = await adminRequest<{ emailSent: boolean }>("/api/admin/applications", {
          method: "POST",
          body: JSON.stringify({ applicationId: target.record.id, decision, reason: reason.trim() || undefined, ...(location ? { lat: location.lat, lng: location.lng } : {}) }),
        });
        if (decision === "VERIFIED") toast({ title: "Hospital approved", description: result.emailSent ? "The applicant has been notified by email." : "Hospital access is active. Add SMTP settings to send decision emails.", variant: "success" });
        else toast({ title: "Application rejected", description: result.emailSent ? "The reason was sent to the applicant." : "The reason is recorded. SMTP is not configured, so email could not be sent.", variant: "warning" });
        setApplicationPage(1);
        setHospitalPage(1);
        await Promise.all([applications.refresh(), hospitals.refresh()]);
      } else {
        await adminRequest("/api/admin/hospitals", {
          method: "POST",
          body: JSON.stringify({ hospitalId: target.record.id, decision, reason: reason.trim() || undefined }),
        });
        toast({ title: decision === "VERIFIED" ? "Hospital verified" : "Hospital rejected", description: "The review decision was saved and audited.", variant: "success" });
        setApplicationPage(1);
        setHospitalPage(1);
        await hospitals.refresh();
      }
      setTarget(null);
    } catch (cause) {
      toast({ title: "Review was not completed", description: cause instanceof Error ? cause.message : "The decision could not be saved.", variant: "error" });
    } finally {
      setSaving(false);
    }
  }

  const loading = applications.loading || hospitals.loading;
  const error = applications.error || hospitals.error;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div><p className="text-xs font-semibold uppercase tracking-[0.15em] text-saffron-700">Platform administration</p><h1 className="mt-1 text-3xl font-bold tracking-tight text-primary-950">Hospitals & verification</h1><p className="mt-2 max-w-3xl text-sm text-slate-600">Review registration details, verify the applicant’s email and map location, then record an approval or a clear rejection reason.</p></div>
        <Button variant="secondary" size="sm" onClick={() => downloadCsv(`hospital-review-${tab.toLowerCase()}-${new Date().toISOString().slice(0, 10)}.csv`, ["Name", "Registration number", "Type", "Status", "Demo data", "City", "Email", "Email verified", "Submitted"], [...appRows.map((item) => [item.hospitalName, item.registrationNumber, item.hospitalType, item.status, "No", item.city, item.user.email, item.user.emailVerifiedAt ? "Yes" : "No", item.createdAt]), ...hospitalRows.map((item) => [item.name, item.registrationNumber, item.type, item.status, item.isDemo ? "Yes" : "No", item.city, item.email, "", item.createdAt])])} disabled={appRows.length + hospitalRows.length === 0}><Download className="mr-2 h-4 w-4" aria-hidden />Export current page</Button>
      </div>
      {error && <AdminError message={error} retry={() => void Promise.all([applications.refresh(), hospitals.refresh()])} />}

      <Card>
        <CardHeader><CardTitle>Review queue</CardTitle><CardDescription>{pendingCount} applications and hospital records are awaiting review. Status counts reflect the full filtered result, not only this page.</CardDescription></CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-wrap gap-2" role="tablist" aria-label="Hospital status filter">
            {tabs.map((value) => <button key={value} type="button" role="tab" aria-selected={tab === value} onClick={() => { setTab(value); setApplicationPage(1); setHospitalPage(1); }} className={`rounded-full px-3.5 py-1.5 text-sm font-medium transition ${tab === value ? "bg-primary-900 text-white" : "bg-slate-100 text-slate-700 hover:bg-slate-200"}`}>{value.replaceAll("_", " ")} <span className="ml-1 opacity-75">{(applications.data?.counts[value] ?? 0) + (hospitals.data?.counts[value] ?? 0)}</span></button>)}
          </div>
          <form onSubmit={applySearch} className="flex flex-wrap gap-3"><Input value={queryDraft} onChange={(event) => setQueryDraft(event.target.value)} placeholder="Search hospital, city, registration number, or applicant email" aria-label="Search hospital reviews" className="min-w-[240px] flex-1" /><Button type="submit">Apply search</Button></form>
          {loading && !applications.data && !hospitals.data ? <p role="status" className="py-8 text-center text-sm text-slate-500">Loading hospital applications…</p> : filteredApps.length + filteredHospitals.length === 0 ? <div className="rounded-lg border border-dashed border-slate-300 px-4 py-12 text-center"><Building2 className="mx-auto h-8 w-8 text-slate-400" aria-hidden /><p className="mt-3 font-medium text-primary-950">No records in this view</p><p className="mt-1 text-sm text-slate-500">Try another status or search, or return when a hospital submits an application.</p></div> : (
            <div className="space-y-3">
              {filteredApps.map((item) => <article key={item.id} className="rounded-xl border border-slate-200 p-4 sm:p-5">
                <div className="flex flex-wrap items-start justify-between gap-4"><div><div className="flex flex-wrap items-center gap-2"><h2 className="text-lg font-semibold text-primary-950">{item.hospitalName}</h2><span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${item.status === "PENDING_VERIFICATION" ? "bg-amber-50 text-amber-800" : item.status === "VERIFIED" ? "bg-green-50 text-green-800" : "bg-red-50 text-red-800"}`}>{item.status.replaceAll("_", " ")}</span></div><p className="mt-1 text-sm text-slate-600">{item.hospitalType} · {item.city}, {item.state} · Submitted {formatAdminDate(item.createdAt)}</p></div><div className="flex flex-wrap gap-2">{item.status === "PENDING_VERIFICATION" && <><Button size="sm" className="gap-1.5" onClick={() => void openReview({ kind: "application", record: item }, "VERIFIED")} disabled={!item.user.emailVerifiedAt}><Check className="h-4 w-4" aria-hidden />Approve</Button><Button variant="secondary" size="sm" className="gap-1.5 text-red-700" onClick={() => void openReview({ kind: "application", record: item }, "REJECTED")}><X className="h-4 w-4" aria-hidden />Reject</Button></>}{item.status === "REJECTED" && <span className="text-sm text-slate-600">Reason: {item.reviewNote || "No note recorded"}</span>}</div></div>
                <dl className="mt-4 grid gap-3 text-sm sm:grid-cols-2 lg:grid-cols-3"><div><dt className="text-xs font-medium uppercase tracking-wide text-slate-500">Registration</dt><dd className="mt-1 text-slate-800">{item.registrationNumber || "Not supplied"}</dd></div><div><dt className="text-xs font-medium uppercase tracking-wide text-slate-500">Address</dt><dd className="mt-1 text-slate-800">{item.addressLine}, {item.city}, {item.state} {item.pincode}</dd></div><div><dt className="text-xs font-medium uppercase tracking-wide text-slate-500">Applicant</dt><dd className="mt-1 text-slate-800">{item.user.name} · {item.user.email} {item.user.emailVerifiedAt ? <span className="text-green-700">(verified)</span> : <span className="text-amber-700">(email not verified)</span>}</dd></div>{item.phone && <div><dt className="text-xs font-medium uppercase tracking-wide text-slate-500">Phone</dt><dd className="mt-1 text-slate-800">{item.phone}</dd></div>}{item.website && <div><dt className="text-xs font-medium uppercase tracking-wide text-slate-500">Website</dt><dd className="mt-1"><a href={item.website} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-primary-700 hover:underline">{item.website}<ExternalLink className="h-3.5 w-3.5" aria-hidden /></a></dd></div>}</dl>
              </article>)}
              {filteredApps.length > 0 && applications.data && <AdminPagination page={applications.data.page} pageSize={applications.data.pageSize} total={applications.data.total} onPage={setApplicationPage} />}
              {filteredHospitals.length > 0 && <h3 className="pt-2 text-sm font-semibold text-primary-950">Existing hospital records</h3>}
              {filteredHospitals.map((item) => <article key={item.id} className="rounded-xl border border-slate-200 p-4 sm:p-5"><div className="flex flex-wrap items-start justify-between gap-4"><div><div className="flex flex-wrap items-center gap-2"><h2 className="text-lg font-semibold text-primary-950">{item.name}</h2>{item.isDemo && <DemoDataBadge />}<span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-semibold text-slate-700">Existing record · {item.status.replaceAll("_", " ")}</span></div><p className="mt-1 text-sm text-slate-600">{item.type} · {item.city}, {item.state} · Added {formatAdminDate(item.createdAt)}</p><p className="mt-2 text-sm text-slate-700">{item.addressLine}, {item.city}, {item.state} {item.pincode}</p></div>{item.status === "PENDING_VERIFICATION" && <div className="flex gap-2"><Button size="sm" onClick={() => void openReview({ kind: "hospital", record: item }, "VERIFIED")}>Verify</Button><Button size="sm" variant="secondary" className="text-red-700" onClick={() => void openReview({ kind: "hospital", record: item }, "REJECTED")}>Reject</Button></div>}</div></article>)}
              {hospitals.data && <AdminPagination page={hospitals.data.page} pageSize={hospitals.data.pageSize} total={hospitals.data.total} onPage={setHospitalPage} />}
            </div>
          )}
        </CardContent>
      </Card>

      <Dialog open={!!target} onOpenChange={(open) => { if (!open && !saving) setTarget(null); }}>
        <DialogContent className="max-w-xl">
          <DialogHeader><DialogTitle>{decision === "VERIFIED" ? "Approve hospital application" : "Reject hospital application"}</DialogTitle><DialogDescription>{target?.kind === "application" ? `Review ${target.record.hospitalName} before recording a decision.` : `Review ${target?.record.name} before recording a decision.`}</DialogDescription></DialogHeader>
          {target && <div className="space-y-4">
            <div className="rounded-lg bg-slate-50 p-3 text-sm text-slate-700">{target.kind === "application" ? `${target.record.addressLine}, ${target.record.city}, ${target.record.state} ${target.record.pincode}` : `${target.record.addressLine}, ${target.record.city}, ${target.record.state} ${target.record.pincode}`}</div>
            {decision === "VERIFIED" && target.kind === "application" && <div className="space-y-2 rounded-lg border border-slate-200 p-3">
              <p className="flex items-center gap-2 text-sm font-semibold text-primary-950"><MapPin className="h-4 w-4" aria-hidden />Map location</p>
              {locationLoading ? <p role="status" className="text-sm text-slate-500">Resolving address…</p> : location ? <><p className="text-sm text-slate-700">{location.label}</p><p className="text-xs text-slate-500">Coordinates: {location.lat.toFixed(5)}, {location.lng.toFixed(5)}</p><label className="flex items-start gap-2 text-sm text-slate-700"><input type="checkbox" checked={locationConfirmed} onChange={(event) => setLocationConfirmed(event.target.checked)} className="mt-0.5" /><span>I checked that this map result matches the registered hospital address.</span></label></> : <p role="alert" className="text-sm text-red-700">{locationError || "Resolve the address before approval."}</p>}
            </div>}
            {decision === "REJECTED" && <div className="space-y-1.5"><Label htmlFor="review-reason">Reason for rejection (required)</Label><textarea id="review-reason" value={reason} onChange={(event) => setReason(event.target.value)} maxLength={300} minLength={8} required className="min-h-24 w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500" placeholder="State what documents or details are missing." /></div>}
            <div className="flex justify-end gap-2 border-t border-slate-100 pt-4"><Button variant="secondary" onClick={() => setTarget(null)} disabled={saving}>Cancel</Button><Button variant={decision === "REJECTED" ? "emergency" : "primary"} onClick={() => void submitReview()} disabled={saving || locationLoading || (decision === "VERIFIED" && target.kind === "application" && (!location || !locationConfirmed)) || (decision === "REJECTED" && reason.trim().length < 8)}>{saving ? "Saving…" : decision === "VERIFIED" ? "Approve and activate" : "Reject application"}</Button></div>
          </div>}
        </DialogContent>
      </Dialog>
    </div>
  );
}
