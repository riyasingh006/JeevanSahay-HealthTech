"use client";

import * as React from "react";
import { Ambulance, BedDouble, Plus, Siren } from "lucide-react";
import { useHospitalPortal } from "@/components/hospital/hospital-store";
import {
  LiveRecordsNotice,
  HospitalStatusBadge,
  NativeSelect,
  PageHeader,
  SectionCard,
  StatCard,
} from "@/components/hospital/hospital-ui";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
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
  emergencySummary,
  availableBedsByType,
  formatHospitalTime,
  type EmergencySeverity,
  type EmergencyStatus,
} from "@/lib/hospital/hospital-data";

const NEXT_STATUS: Record<EmergencyStatus, EmergencyStatus[]> = {
  RECEIVED: ["IN_TREATMENT", "STABILIZED"],
  IN_TREATMENT: ["STABILIZED", "DISCHARGED"],
  STABILIZED: ["IN_TREATMENT", "DISCHARGED"],
  DISCHARGED: [],
};
const SEV_OPTS: EmergencySeverity[] = ["CRITICAL", "URGENT", "MODERATE"];

export default function HospitalEmergencyPage() {
  const { emergencyCases, beds, bedInventory, departments, updateEmergencyStatus, addEmergencyCase, loading } = useHospitalPortal();
  const { toast } = useToast();
  const [severityFilter, setSeverityFilter] = React.useState("all");
  const [statusFilter, setStatusFilter] = React.useState("active");
  const [createOpen, setCreateOpen] = React.useState(false);
  const [saving, setSaving] = React.useState(false);
  const [form, setForm] = React.useState({
    reference: "",
    patientRef: "",
    age: "",
    condition: "",
    severity: "MODERATE" as EmergencySeverity,
    department: "",
    location: "",
  });

  const summary = emergencySummary(emergencyCases);
  const icuAvail = availableBedsByType(bedInventory, beds, "ICU");
  const erAggregate = bedInventory.find((item) => item.category === "EMERGENCY");
  const erTotal = erAggregate?.total ?? beds.filter((bed) => bed.bedType === "EMERGENCY").length;
  const erAvailable = erAggregate?.available ?? beds.filter((bed) => bed.bedType === "EMERGENCY" && bed.status === "AVAILABLE").length;

  const filtered = React.useMemo(() => {
    return emergencyCases.filter((e) => {
      if (severityFilter !== "all" && e.severity !== severityFilter) return false;
      if (statusFilter === "active" && e.status === "DISCHARGED") return false;
      if (statusFilter === "discharged" && e.status !== "DISCHARGED") return false;
      return true;
    });
  }, [emergencyCases, severityFilter, statusFilter]);

  async function updateStatus(id: string, status: EmergencyStatus) {
    const result = await updateEmergencyStatus(id, status);
    if (!result.ok) {
      toast({ title: "Could not update case", description: result.error, variant: "error" });
      return;
    }
    toast({ title: "Emergency status updated", description: "The case record was saved.", variant: "success" });
  }

  async function submitCase(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    const result = await addEmergencyCase({
      reference: form.reference.trim() || undefined,
      patientRef: form.patientRef.trim(),
      age: form.age.trim() ? Number(form.age) : null,
      condition: form.condition.trim(),
      severity: form.severity,
      department: form.department,
      location: form.location.trim(),
    });
    setSaving(false);
    if (!result.ok) {
      toast({ title: "Could not log emergency case", description: result.error, variant: "error" });
      return;
    }
    toast({ title: "Emergency case logged", description: "The case was saved to your hospital records.", variant: "success" });
    setCreateOpen(false);
    setForm({ reference: "", patientRef: "", age: "", condition: "", severity: "MODERATE", department: "", location: "" });
  }

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Hospital Management"
        title="Emergency Status"
        description="Monitor live emergency cases, severity, location, assigned department, and ICU availability."
        icon={Siren}
        actions={
          <div className="flex flex-wrap gap-2">
            <Button variant="emergency" size="sm" className="gap-1.5" asChild>
              <a href="tel:112"><Ambulance className="h-4 w-4" aria-hidden />Emergency Line 112</a>
            </Button>
            <Button size="sm" className="gap-1.5" onClick={() => setCreateOpen(true)}>
              <Plus className="h-4 w-4" aria-hidden />Log Case
            </Button>
          </div>
        }
      />

      <LiveRecordsNotice>
        This is a staff-managed incident log, not an emergency dispatch or clinical record system. Do not enter patient identifiers or rely on it for real-time response.
      </LiveRecordsNotice>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="Active Cases" value={summary.active} hint="Not discharged" icon={Siren} tone="red" />
        <StatCard label="Critical" value={summary.critical} hint="Requires immediate attention" icon={Siren} tone="red" />
        <StatCard label="In Treatment" value={summary.inTreatment} hint="Currently being treated" icon={Ambulance} tone="amber" />
        <StatCard label="Available ICU Beds" value={icuAvail} hint={`${erAvailable} emergency beds available`} icon={BedDouble} tone="blue" />
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <SectionCard title="Emergency Department Capacity" description="Inventory reported by this hospital">
          <div className="space-y-2 text-sm">
            <div className="flex items-center justify-between"><span className="text-slate-600">Emergency beds</span><span className="tabular-nums text-primary-900">{erAvailable} available / {erTotal} total</span></div>
            <div className="flex items-center justify-between"><span className="text-slate-600">Active cases</span><span className="tabular-nums text-primary-900">{summary.active}</span></div>
            <div className="flex items-center justify-between"><span className="text-slate-600">Critical cases</span><span className="tabular-nums text-primary-900">{summary.critical}</span></div>
          </div>
        </SectionCard>
        <SectionCard title="Critical Care Capacity" description="Available bed inventory">
          <div className="space-y-2 text-sm">
            <div className="flex items-center justify-between"><span className="text-slate-600">ICU beds</span><span className="tabular-nums text-primary-900">{icuAvail} available</span></div>
            <div className="flex items-center justify-between"><span className="text-slate-600">Ventilator beds</span><span className="tabular-nums text-primary-900">{availableBedsByType(bedInventory, beds, "VENTILATOR")} available</span></div>
            <div className="flex items-center justify-between"><span className="text-slate-600">In treatment</span><span className="tabular-nums text-primary-900">{summary.inTreatment}</span></div>
          </div>
        </SectionCard>
        <SectionCard title="Response Overview" description="live queue state">
          <div className="space-y-2 text-sm">
            <div className="flex items-center justify-between"><span className="text-slate-600">Received</span><span className="tabular-nums">{summary.received}</span></div>
            <div className="flex items-center justify-between"><span className="text-slate-600">In Treatment</span><span className="tabular-nums">{summary.inTreatment}</span></div>
            <div className="flex items-center justify-between"><span className="text-slate-600">Stabilized</span><span className="tabular-nums">{summary.stabilized}</span></div>
          </div>
        </SectionCard>
      </div>

      <SectionCard
        title="Emergency Cases"
        description="live cases with severity indicators, time reported, status, assigned department and location."
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <NativeSelect value={severityFilter} onChange={(e) => setSeverityFilter(e.target.value)} className="h-9 w-40">
              <option value="all">All severity</option>
              {SEV_OPTS.map((s) => <option key={s} value={s}>{s}</option>)}
            </NativeSelect>
            <NativeSelect value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} className="h-9 w-40">
              <option value="active">Active only</option>
              <option value="all">All statuses</option>
              <option value="discharged">Discharged</option>
            </NativeSelect>
          </div>
        }
      >
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Case Ref</TableHead>
                <TableHead>Patient</TableHead>
                <TableHead>Condition</TableHead>
                <TableHead>Severity</TableHead>
                <TableHead>Department</TableHead>
                <TableHead>Location</TableHead>
                <TableHead>Time Reported</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Update Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map((e) => (
                <TableRow key={e.id}>
                  <TableCell className="font-medium tabular-nums text-primary-950">{e.reference}</TableCell>
                  <TableCell>{e.patientRef}{e.age == null ? "" : ` • ${e.age}y`}</TableCell>
                  <TableCell className="max-w-xs truncate text-sm text-slate-700">{e.condition}</TableCell>
                  <TableCell><HospitalStatusBadge status={e.severity} size="sm" /></TableCell>
                  <TableCell className="text-sm text-slate-600">{e.department}</TableCell>
                  <TableCell className="text-sm text-slate-600">{e.location}</TableCell>
                  <TableCell className="text-xs text-slate-500">{formatHospitalTime(e.reportedAt)}</TableCell>
                  <TableCell><HospitalStatusBadge status={e.status} size="sm" /></TableCell>
                  <TableCell className="text-right">
                    <NativeSelect
                      value={e.status}
                      onChange={(ev) => updateStatus(e.id, ev.target.value as EmergencyStatus)}
                      className="ml-auto h-8 w-36 text-xs"
                    >
                      {[e.status, ...NEXT_STATUS[e.status]].map((status) => <option key={status} value={status}>{status.replaceAll("_", " ")}</option>)}
                    </NativeSelect>
                  </TableCell>
                </TableRow>
              ))}
              {!loading && filtered.length === 0 && (
                <TableRow>
                  <TableCell colSpan={9} className="h-24 text-center text-sm text-slate-500">
                    {emergencyCases.length === 0 ? "No emergency cases have been logged." : "No cases match the current filters."}
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </div>
      </SectionCard>

      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Log emergency case</DialogTitle>
            <DialogDescription>Record triage status only. Do not enter names, phone numbers, identity numbers, or clinical notes.</DialogDescription>
          </DialogHeader>
          <form onSubmit={submitCase} className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label htmlFor="case-reference">Case reference (optional)</Label>
                <Input id="case-reference" value={form.reference} onChange={(event) => setForm({ ...form, reference: event.target.value })} maxLength={24} placeholder="Generated if blank" />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="case-patient-ref">Anonymous case label</Label>
                <Input id="case-patient-ref" value={form.patientRef} onChange={(event) => setForm({ ...form, patientRef: event.target.value })} minLength={2} maxLength={60} required placeholder="e.g. Case A-12" />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="case-age">Age (optional)</Label>
                <Input id="case-age" type="number" min={0} max={120} value={form.age} onChange={(event) => setForm({ ...form, age: event.target.value })} />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="case-severity">Severity</Label>
                <NativeSelect id="case-severity" value={form.severity} onChange={(event) => setForm({ ...form, severity: event.target.value as EmergencySeverity })}>
                  {SEV_OPTS.map((severity) => <option key={severity} value={severity}>{severity}</option>)}
                </NativeSelect>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="case-department">Department</Label>
                <NativeSelect id="case-department" value={form.department} onChange={(event) => setForm({ ...form, department: event.target.value })}>
                  <option value="">Unassigned</option>
                  {departments.map((department) => <option key={department.id} value={department.name}>{department.name}</option>)}
                </NativeSelect>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="case-location">Location (optional)</Label>
                <Input id="case-location" value={form.location} onChange={(event) => setForm({ ...form, location: event.target.value })} maxLength={120} placeholder="e.g. Emergency entrance" />
              </div>
              <div className="space-y-1.5 sm:col-span-2">
                <Label htmlFor="case-condition">Triage category or concise condition</Label>
                <textarea id="case-condition" value={form.condition} onChange={(event) => setForm({ ...form, condition: event.target.value })} maxLength={200} minLength={2} required className="min-h-20 w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 outline-none focus-visible:ring-2 focus-visible:ring-primary-500" placeholder="Only information needed for triage" />
              </div>
            </div>
            <div className="flex justify-end gap-2 border-t border-slate-100 pt-4">
              <Button type="button" variant="secondary" onClick={() => setCreateOpen(false)} disabled={saving}>Cancel</Button>
              <Button type="submit" disabled={saving}>{saving ? "Saving…" : "Save case"}</Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
