"use client";

import * as React from "react";
import {
  BedDouble,
  Filter,
  Plus,
  Search,
  Trash2,
} from "lucide-react";
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
  bedInventoryCounts,
  bedInventoryByType,
  formatHospitalTime,
  type BedStatus,
  type BedType,
} from "@/lib/hospital/hospital-data";

const STATUS_OPTIONS: BedStatus[] = ["AVAILABLE", "OCCUPIED", "RESERVED", "MAINTENANCE"];

export default function HospitalBedsPage() {
  const { beds, bedInventory, departments, addBed, updateBed, removeBed, loading, error, refresh } = useHospitalPortal();
  const { toast } = useToast();
  const [saving, setSaving] = React.useState(false);
  const [query, setQuery] = React.useState("");
  const [wardFilter, setWardFilter] = React.useState("all");
  const [statusFilter, setStatusFilter] = React.useState("all");
  const [typeFilter, setTypeFilter] = React.useState("all");
  const [open, setOpen] = React.useState(false);
  const [editId, setEditId] = React.useState<string | null>(null);
  const [form, setForm] = React.useState<{
    id: string;
    ward: string;
    bedType: BedType;
    department: string;
    status: BedStatus;
  }>({ id: "", ward: "", bedType: "GENERAL", department: "", status: "AVAILABLE" });

  const counts = bedInventoryCounts(bedInventory, beds);
  const byType = bedInventoryByType(bedInventory, beds);

  const wards = React.useMemo(
    () => Array.from(new Set(beds.map((b) => b.ward))),
    [beds]
  );
  const types = React.useMemo(
    () => Array.from(new Set(beds.map((b) => b.bedType))),
    [beds]
  );

  const filtered = React.useMemo(() => {
    const q = query.trim().toLowerCase();
    return beds.filter((bed) => {
      if (wardFilter !== "all" && bed.ward !== wardFilter) return false;
      if (statusFilter !== "all" && bed.status !== statusFilter) return false;
      if (typeFilter !== "all" && bed.bedType !== typeFilter) return false;
      if (!q) return true;
      return (
        bed.id.toLowerCase().includes(q) ||
        bed.ward.toLowerCase().includes(q) ||
        bed.department.toLowerCase().includes(q)
      );
    });
  }, [beds, query, wardFilter, statusFilter, typeFilter]);

  function openCreate() {
    setEditId(null);
    setForm({ id: "", ward: "", bedType: "GENERAL", department: "", status: "AVAILABLE" });
    setOpen(true);
  }

  function openEdit(bedId: string) {
    const bed = beds.find((b) => b.id === bedId);
    if (!bed) return;
    setEditId(bed.id);
    setForm({ id: bed.id, ward: bed.ward, bedType: bed.bedType, department: bed.department === "Unassigned" ? "" : bed.department, status: bed.status });
    setOpen(true);
  }

  async function submit() {
    setSaving(true);
    const result = editId
      ? await updateBed(editId, { ward: form.ward, bedType: form.bedType, department: form.department, status: form.status })
      : await addBed(form);
    setSaving(false);
    if (!result.ok) {
      toast({ title: editId ? "Could not update bed" : "Could not add bed", description: result.error, variant: "error" });
      return;
    }
    toast({ title: editId ? "Bed updated" : "Bed added", description: `${form.id.toUpperCase()} was saved to hospital records.`, variant: "success" });
    setOpen(false);
  }

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Hospital Management"
        title="Bed Management"
        description="Track ward-wise beds, manage status, and maintain a structured live inventory with validation and feedback."
        icon={BedDouble}
        actions={
          <Button size="sm" className="gap-1.5" onClick={openCreate}>
            <Plus className="h-4 w-4" aria-hidden />
            Add live Bed
          </Button>
        }
      />

      {loading && <p role="status" className="text-sm text-slate-500">Loading hospital records…</p>}
      {error && (
        <div role="alert" className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-rose-200 bg-rose-50 p-3 text-sm text-rose-800">
          <span>{error}</span>
          <Button variant="secondary" size="sm" onClick={() => void refresh()}>Retry</Button>
        </div>
      )}

      <LiveRecordsNotice>
        Bed records are stored for this verified hospital. Availability is self-reported here and is not a live feed from hospital equipment or an EHR.
      </LiveRecordsNotice>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
        <StatCard label="Total Beds" value={counts.total} hint="All categories" icon={BedDouble} tone="blue" />
        <StatCard label="Available" value={counts.available} hint="Ready for use" icon={BedDouble} tone="green" />
        <StatCard label="Occupied" value={counts.occupied} hint="Currently in use" icon={BedDouble} tone="amber" />
        <StatCard label="Reserved" value={counts.reserved} hint="Held for patients" icon={BedDouble} tone="violet" />
        <StatCard label="Maintenance" value={counts.maintenance} hint="Out of service" icon={BedDouble} tone="red" />
      </div>

      <SectionCard
        title="Ward-wise Bed Information"
        description="ICU, General, Emergency, Private, Pediatric, Maternity, Isolation and Ventilator categories."
      >
        <div className="grid gap-2 md:grid-cols-2 xl:grid-cols-4">
          {byType.map((entry) => (
            <div key={entry.bedType} className="rounded-lg border border-slate-200 p-3">
              <p className="font-medium text-primary-950">{entry.bedType}</p>
              <p className="mt-0.5 text-xs text-slate-500">
                {entry.available} available / {entry.total} total
              </p>
              <div className="mt-2 flex items-center justify-between text-xs">
                <span className="text-slate-500">Occupied {entry.occupied}</span>
                <span className="tabular-nums text-primary-700">
                  {entry.total ? Math.round((entry.occupied / entry.total) * 100) : 0}% used
                </span>
              </div>
            </div>
          ))}
        </div>
      </SectionCard>

      <SectionCard
        title="Bed Inventory"
        description={`Showing ${filtered.length} of ${beds.length} hospital records`}
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <div className="relative">
              <Search className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" aria-hidden />
              <Input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search bed, ward, department"
                className="h-9 w-64 pl-9"
              />
            </div>
            <NativeSelect value={wardFilter} onChange={(e) => setWardFilter(e.target.value)} className="h-9 w-44">
              <option value="all">All wards</option>
              {wards.map((w) => <option key={w} value={w}>{w}</option>)}
            </NativeSelect>
            <NativeSelect value={typeFilter} onChange={(e) => setTypeFilter(e.target.value)} className="h-9 w-40">
              <option value="all">All types</option>
              {types.map((t) => <option key={t} value={t}>{t}</option>)}
            </NativeSelect>
            <NativeSelect value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} className="h-9 w-40">
              <option value="all">All statuses</option>
              {STATUS_OPTIONS.map((s) => <option key={s} value={s}>{s}</option>)}
            </NativeSelect>
          </div>
        }
      >
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Bed ID</TableHead>
                <TableHead>Ward</TableHead>
                <TableHead>Bed Type</TableHead>
                <TableHead>Department</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Last Updated</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map((bed) => (
                <TableRow key={bed.id}>
                  <TableCell className="font-medium tabular-nums text-primary-950">{bed.id}</TableCell>
                  <TableCell>{bed.ward}</TableCell>
                  <TableCell>{bed.bedType}</TableCell>
                  <TableCell className="text-slate-600">{bed.department}</TableCell>
                  <TableCell><HospitalStatusBadge status={bed.status} size="sm" /></TableCell>
                  <TableCell className="text-xs text-slate-500">{formatHospitalTime(bed.updatedAt)}</TableCell>
                  <TableCell className="text-right">
                    <div className="flex justify-end gap-1">
                      <Button variant="ghost" size="sm" onClick={() => openEdit(bed.id)}>Edit / Update</Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="text-red-700"
                        onClick={async () => {
                          const result = await removeBed(bed.id);
                          toast(result.ok
                            ? { title: "Bed removed", description: `${bed.id} was removed from hospital records.`, variant: "success" }
                            : { title: "Could not remove bed", description: result.error, variant: "error" });
                        }}
                      >
                        <Trash2 className="h-3.5 w-3.5" aria-hidden />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
        {filtered.length === 0 && (
          <div className="flex flex-col items-center justify-center gap-2 py-10 text-center">
            <Filter className="h-5 w-5 text-slate-400" aria-hidden />
            <p className="text-sm font-medium text-primary-950">{beds.length === 0 ? "No bed records yet" : "No beds match the filters"}</p>
            <p className="text-xs text-slate-500">{beds.length === 0 ? "Add the beds your hospital wants to publish." : "Adjust search or filters to see more records."}</p>
          </div>
        )}
      </SectionCard>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{editId ? "Update Bed" : "Add Bed"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1.5">
              <Label htmlFor="bed-id">Bed ID</Label>
              <Input
                id="bed-id"
                value={form.id}
                onChange={(e) => setForm((f) => ({ ...f, id: e.target.value }))}
                disabled={!!editId}
                placeholder="e.g. GW-C-012"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="bed-ward">Ward</Label>
              <Input id="bed-ward" value={form.ward} onChange={(e) => setForm((f) => ({ ...f, ward: e.target.value }))} placeholder="e.g. North Wing" />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="bed-type">Bed Type</Label>
              <NativeSelect id="bed-type" value={form.bedType} onChange={(e) => setForm((f) => ({ ...f, bedType: e.target.value as BedType }))}>
                {["GENERAL", "ICU", "EMERGENCY", "PRIVATE", "PEDIATRIC", "MATERNITY", "ISOLATION", "VENTILATOR"].map((type) => <option key={type} value={type}>{type}</option>)}
              </NativeSelect>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="bed-department">Department</Label>
              <NativeSelect id="bed-department" value={form.department} onChange={(e) => setForm((f) => ({ ...f, department: e.target.value }))}>
                <option value="">Unassigned</option>
                {departments.filter((department) => department.status === "ACTIVE").map((department) => <option key={department.id} value={department.name}>{department.name}</option>)}
              </NativeSelect>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="bed-status">Status</Label>
              <NativeSelect
                id="bed-status"
                value={form.status}
                onChange={(e) => setForm((f) => ({ ...f, status: e.target.value as BedStatus }))}
              >
                {STATUS_OPTIONS.map((s) => (
                  <option key={s} value={s}>
                    {s}
                  </option>
                ))}
              </NativeSelect>
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <Button variant="secondary" onClick={() => setOpen(false)}>
                Cancel
              </Button>
              <Button onClick={submit} disabled={saving}>{saving ? "Saving…" : editId ? "Save Changes" : "Add Bed"}</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
