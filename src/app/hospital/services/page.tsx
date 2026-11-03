"use client";

import * as React from "react";
import { HeartPulse, Plus, Search } from "lucide-react";
import { useHospitalPortal } from "@/components/hospital/hospital-store";
import {
  LiveRecordsNotice,
  HospitalStatusBadge,
  NativeSelect,
  PageHeader,
  SectionCard,
  StatCard,
} from "@/components/hospital/hospital-ui";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { useToast } from "@/components/ui/toast";
import { serviceStatusCounts, type ServiceStatus } from "@/lib/hospital/hospital-data";

const STATUS_OPTS: ServiceStatus[] = ["AVAILABLE", "LIMITED", "UNAVAILABLE"];

export default function HospitalServicesPage() {
  const { services, departments, addService, updateService, removeService, loading } = useHospitalPortal();
  const { toast } = useToast();
  const [query, setQuery] = React.useState("");
  const [deptFilter, setDeptFilter] = React.useState("all");
  const [statusFilter, setStatusFilter] = React.useState("all");
  const [open, setOpen] = React.useState(false);
  const [editId, setEditId] = React.useState<string | null>(null);
  const [saving, setSaving] = React.useState(false);  const [removingId, setRemovingId] = React.useState<string | null>(null);

  const [form, setForm] = React.useState({
    name: "",
    department: departments[0]?.name ?? "",
    status: "AVAILABLE" as ServiceStatus,
    hours: "24x7",
    description: "",
  });

  const counts = serviceStatusCounts(services);
  const depts = React.useMemo(() => Array.from(new Set(services.map((s) => s.department))), [services]);

  const filtered = React.useMemo(() => {
    const q = query.trim().toLowerCase();
    return services.filter((s) => {
      if (deptFilter !== "all" && s.department !== deptFilter) return false;
      if (statusFilter !== "all" && s.status !== statusFilter) return false;
      if (!q) return true;
      return s.name.toLowerCase().includes(q) || s.description.toLowerCase().includes(q);
    });
  }, [services, query, deptFilter, statusFilter]);

  function openCreate() {
    setEditId(null);
    setForm({ name: "", department: departments[0]?.name ?? "", status: "AVAILABLE", hours: "24x7", description: "" });
    setOpen(true);
  }

  function openEdit(id: string) {
    const svc = services.find((s) => s.id === id);
    if (!svc) return;
    setEditId(svc.id);
    setForm({ name: svc.name, department: svc.department, status: svc.status, hours: svc.hours, description: svc.description });
    setOpen(true);
  }

  async function submit() {
    setSaving(true);
    const result = editId ? await updateService(editId, form) : await addService(form);
    setSaving(false);
    if (!result.ok) {
      toast({ title: editId ? "Could not update service" : "Could not add service", description: result.error, variant: "error" });
      return;
    }
    toast({ title: editId ? "Service updated" : "Service added", description: "The service record was saved.", variant: "success" });
    setOpen(false);
  }

  async function deleteService(id: string, name: string) {
    if (!window.confirm(`Remove ${name} from this hospital's service list?`)) return;
    setRemovingId(id);
    const result = await removeService(id);
    setRemovingId(null);
    if (!result.ok) {
      toast({ title: "Could not remove service", description: result.error, variant: "error" });
      return;
    }
    toast({ title: "Service removed", description: "The service record was removed.", variant: "success" });
  }

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Hospital Management"
        title="Healthcare Services"
        description="Manage services like Emergency Care, Cardiology, Orthopedics, Radiology, and Laboratory Services."
        icon={HeartPulse}
        actions={
          <Button size="sm" className="gap-1.5" onClick={openCreate}>
            <Plus className="h-4 w-4" aria-hidden />
            Add Service
          </Button>
        }
      />

      <LiveRecordsNotice>
        Service records are stored for this verified hospital. Public availability reflects the status saved here and may not match an external scheduling system.
      </LiveRecordsNotice>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="Total Services" value={counts.total} hint="In directory" icon={HeartPulse} tone="blue" />
        <StatCard label="Available" value={counts.available} hint="Operational" icon={HeartPulse} tone="green" />
        <StatCard label="Limited" value={counts.limited} hint="Constrained slots" icon={HeartPulse} tone="amber" />
        <StatCard label="Unavailable" value={counts.unavailable} hint="Temporarily down" icon={HeartPulse} tone="red" />
      </div>

      <SectionCard
        title="Services Directory"
        description={`${filtered.length} services`}
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <div className="relative">
              <Search className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" aria-hidden />
              <Input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search service" className="h-9 w-56 pl-9" />
            </div>
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
                <TableHead>Service</TableHead>
                <TableHead>Department</TableHead>
                <TableHead>Availability</TableHead>
                <TableHead>Operating Hours</TableHead>
                <TableHead>Description</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map((svc) => (
                <TableRow key={svc.id}>
                  <TableCell className="font-medium text-primary-950">{svc.name}</TableCell>
                  <TableCell className="text-sm text-slate-600">{svc.department}</TableCell>
                  <TableCell><HospitalStatusBadge status={svc.status} size="sm" /></TableCell>
                  <TableCell className="text-sm text-slate-600">{svc.hours}</TableCell>
                  <TableCell className="max-w-sm truncate text-sm text-slate-600">{svc.description}</TableCell>
                  <TableCell className="text-right">
                    <div className="flex justify-end gap-1">
                      <Button variant="ghost" size="sm" onClick={() => openEdit(svc.id)}>Edit</Button>
                      <Button variant="ghost" size="sm" className="text-red-700" disabled={removingId === svc.id} onClick={() => void deleteService(svc.id, svc.name)}>{removingId === svc.id ? "Removing…" : "Remove"}</Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
              {!loading && filtered.length === 0 && (
                <TableRow>
                  <TableCell colSpan={6} className="h-24 text-center text-sm text-slate-500">
                    {services.length === 0 ? "No services have been added yet." : "No services match the current search or filters."}
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </div>
      </SectionCard>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-xl">
          <DialogHeader>
            <DialogTitle>{editId ? "Edit Service" : "Add Service"}</DialogTitle>
          </DialogHeader>
          <div className="grid gap-3 md:grid-cols-2">
            <div className="space-y-1.5 md:col-span-2">
              <Label htmlFor="svc-name">Service Name</Label>
              <Input id="svc-name" value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="svc-dept">Department</Label>
              <NativeSelect id="svc-dept" value={form.department} onChange={(e) => setForm((f) => ({ ...f, department: e.target.value }))}>
                {departments.map((d) => <option key={d.id} value={d.name}>{d.name}</option>)}
              </NativeSelect>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="svc-status">Availability</Label>
              <NativeSelect id="svc-status" value={form.status} onChange={(e) => setForm((f) => ({ ...f, status: e.target.value as ServiceStatus }))}>
                {STATUS_OPTS.map((s) => <option key={s} value={s}>{s}</option>)}
              </NativeSelect>
            </div>
            <div className="space-y-1.5 md:col-span-2">
              <Label htmlFor="svc-hours">Operating Hours</Label>
              <Input id="svc-hours" value={form.hours} onChange={(e) => setForm((f) => ({ ...f, hours: e.target.value }))} />
            </div>
            <div className="space-y-1.5 md:col-span-2">
              <Label htmlFor="svc-desc">Service Description</Label>
              <Textarea id="svc-desc" value={form.description} onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))} />
            </div>
          </div>
          <div className="flex justify-end gap-2">
            <Button variant="secondary" onClick={() => setOpen(false)}>Cancel</Button>
            <Button onClick={submit} disabled={saving}>{saving ? "Saving…" : editId ? "Save Changes" : "Add Service"}</Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
