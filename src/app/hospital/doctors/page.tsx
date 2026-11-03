"use client";

import * as React from "react";
import { Plus, Search, Stethoscope, UserRoundCheck } from "lucide-react";
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
  doctorAvailabilityCounts,
  type DoctorAvailability,
} from "@/lib/hospital/hospital-data";

const AVAIL_OPTIONS: DoctorAvailability[] = ["AVAILABLE", "LIMITED", "UNAVAILABLE"];

export default function HospitalDoctorsPage() {
  const { doctors, departments, addDoctor, updateDoctor, toggleDoctorAvailability, loading } =
    useHospitalPortal();
  const { toast } = useToast();
  const [query, setQuery] = React.useState("");
  const [deptFilter, setDeptFilter] = React.useState("all");
  const [specFilter, setSpecFilter] = React.useState("all");
  const [availFilter, setAvailFilter] = React.useState("all");
  const [open, setOpen] = React.useState(false);
  const [editId, setEditId] = React.useState<string | null>(null);
  const [saving, setSaving] = React.useState(false);
  const [form, setForm] = React.useState({
    name: "",
    specialty: "",
    department: departments[0]?.name ?? "",
    qualification: "",
    experienceYears: 5,
    availability: "AVAILABLE" as DoctorAvailability,
    shift: "09:00 - 17:00",
    phone: "",
    email: "",
  });

  const counts = doctorAvailabilityCounts(doctors);
  const specialties = React.useMemo(
    () => Array.from(new Set(doctors.map((d) => d.specialty))),
    [doctors]
  );
  const depts = React.useMemo(
    () => Array.from(new Set(doctors.map((d) => d.department))),
    [doctors]
  );

  const filtered = React.useMemo(() => {
    const q = query.trim().toLowerCase();
    return doctors.filter((doc) => {
      if (deptFilter !== "all" && doc.department !== deptFilter) return false;
      if (specFilter !== "all" && doc.specialty !== specFilter) return false;
      if (availFilter !== "all" && doc.availability !== availFilter) return false;
      if (!q) return true;
      return (
        doc.name.toLowerCase().includes(q) ||
        doc.specialty.toLowerCase().includes(q) ||
        doc.email.toLowerCase().includes(q) ||
        doc.phone.includes(q)
      );
    });
  }, [doctors, query, deptFilter, specFilter, availFilter]);

  function openCreate() {
    setEditId(null);
    setForm({
      name: "",
      specialty: "",
      department: departments[0]?.name ?? "",
      qualification: "",
      experienceYears: 5,
      availability: "AVAILABLE",
      shift: "09:00 - 17:00",
      phone: "",
      email: "",
    });
    setOpen(true);
  }

  function openEdit(docId: string) {
    const doc = doctors.find((d) => d.id === docId);
    if (!doc) return;
    setEditId(doc.id);
    setForm({
      name: doc.name,
      specialty: doc.specialty,
      department: doc.department,
      qualification: doc.qualification,
      experienceYears: doc.experienceYears,
      availability: doc.availability,
      shift: doc.shift,
      phone: doc.phone,
      email: doc.email,
    });
    setOpen(true);
  }

  async function submit() {
    const input = {
      name: form.name.trim(),
      specialty: form.specialty.trim(),
      department: form.department.trim(),
      qualification: form.qualification.trim(),
      experienceYears: Math.max(0, Number(form.experienceYears) || 0),
      availability: form.availability,
      shift: form.shift.trim(),
      phone: form.phone.trim(),
      email: form.email.trim(),
    };
    setSaving(true);
    const result = editId ? await updateDoctor(editId, input) : await addDoctor(input);
    setSaving(false);
    if (!result.ok) {
      toast({ title: editId ? "Could not update doctor" : "Could not add doctor", description: result.error, variant: "error" });
      return;
    }
    toast({ title: editId ? "Doctor updated" : "Doctor added", description: "The doctor record was saved.", variant: "success" });
    setOpen(false);
  }

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Hospital Management"
        title="Doctor Management"
        description="Manage doctors, specialties, departments, shifts, contact details, and availability with validation."
        icon={Stethoscope}
        actions={
          <Button size="sm" className="gap-1.5" onClick={openCreate}>
            <Plus className="h-4 w-4" aria-hidden />
            Add Doctor
          </Button>
        }
      />

      <LiveRecordsNotice>
        Doctor profiles are saved to this verified hospital. Availability is self-reported and appears in the public directory where applicable.
      </LiveRecordsNotice>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="Total Doctors" value={counts.total} hint="In hospital roster" icon={Stethoscope} tone="blue" />
        <StatCard label="Available" value={counts.available} hint="Ready for duty" icon={UserRoundCheck} tone="green" />
        <StatCard label="Limited" value={counts.limited} hint="Partial availability" icon={Stethoscope} tone="amber" />
        <StatCard label="Unavailable" value={counts.unavailable} hint="Off-duty / leave" icon={Stethoscope} tone="red" />
      </div>

      <SectionCard
        title="Doctor Directory"
        description={`${filtered.length} doctors shown`}
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <div className="relative">
              <Search className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" aria-hidden />
              <Input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search name, specialty, email"
                className="h-9 w-64 pl-9"
              />
            </div>
            <NativeSelect value={deptFilter} onChange={(e) => setDeptFilter(e.target.value)} className="h-9 w-48">
              <option value="all">All departments</option>
              {depts.map((d) => <option key={d} value={d}>{d}</option>)}
            </NativeSelect>
            <NativeSelect value={specFilter} onChange={(e) => setSpecFilter(e.target.value)} className="h-9 w-44">
              <option value="all">All specialties</option>
              {specialties.map((s) => <option key={s} value={s}>{s}</option>)}
            </NativeSelect>
            <NativeSelect value={availFilter} onChange={(e) => setAvailFilter(e.target.value)} className="h-9 w-40">
              <option value="all">All status</option>
              {AVAIL_OPTIONS.map((a) => <option key={a} value={a}>{a}</option>)}
            </NativeSelect>
          </div>
        }
      >
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Doctor</TableHead>
                <TableHead>Specialty / Department</TableHead>
                <TableHead>Qualification & Exp</TableHead>
                <TableHead>Shift / Working Hours</TableHead>
                <TableHead>Contact</TableHead>
                <TableHead>Availability</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map((doc) => (
                <TableRow key={doc.id}>
                  <TableCell>
                    <p className="font-medium text-primary-950">{doc.name}</p>
                  </TableCell>
                  <TableCell>
                    <p className="text-sm text-primary-900">{doc.specialty}</p>
                    <p className="text-xs text-slate-500">{doc.department}</p>
                  </TableCell>
                  <TableCell>
                    <p className="text-sm text-slate-700">{doc.qualification}</p>
                    <p className="text-xs text-slate-500">{doc.experienceYears} yrs exp</p>
                  </TableCell>
                  <TableCell className="text-sm text-slate-700">{doc.shift}</TableCell>
                  <TableCell>
                    <p className="text-xs text-slate-600">{doc.phone}</p>
                    <p className="text-xs text-slate-500">{doc.email}</p>
                  </TableCell>
                  <TableCell><HospitalStatusBadge status={doc.availability} size="sm" /></TableCell>
                  <TableCell className="text-right">
                    <div className="flex justify-end gap-1">
                      <Button variant="ghost" size="sm" onClick={() => openEdit(doc.id)}>Edit</Button>
                      <Button variant="ghost" size="sm" onClick={() => toggleDoctorAvailability(doc.id)}>
                        {doc.availability === "UNAVAILABLE" ? "Activate" : "Deactivate"}
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
              {!loading && filtered.length === 0 && (
                <TableRow>
                  <TableCell colSpan={7} className="h-24 text-center text-sm text-slate-500">
                    {doctors.length === 0 ? "No doctors have been added yet." : "No doctors match the current search or filters."}
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </div>
      </SectionCard>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>{editId ? "Edit Doctor" : "Add Doctor"}</DialogTitle>
          </DialogHeader>
          <div className="grid gap-3 md:grid-cols-2">
            <div className="space-y-1.5 md:col-span-2">
              <Label htmlFor="doc-name">Full Name</Label>
              <Input id="doc-name" value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="doc-specialty">Specialty</Label>
              <Input id="doc-specialty" value={form.specialty} onChange={(e) => setForm((f) => ({ ...f, specialty: e.target.value }))} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="doc-dept">Department</Label>
              <NativeSelect id="doc-dept" value={form.department} onChange={(e) => setForm((f) => ({ ...f, department: e.target.value }))}>
                {departments.map((d) => <option key={d.id} value={d.name}>{d.name}</option>)}
              </NativeSelect>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="doc-qual">Qualification</Label>
              <Input id="doc-qual" value={form.qualification} onChange={(e) => setForm((f) => ({ ...f, qualification: e.target.value }))} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="doc-exp">Experience (years)</Label>
              <Input id="doc-exp" type="number" min={0} value={form.experienceYears} onChange={(e) => setForm((f) => ({ ...f, experienceYears: Number(e.target.value) }))} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="doc-shift">Shift / Working Hours</Label>
              <Input id="doc-shift" value={form.shift} onChange={(e) => setForm((f) => ({ ...f, shift: e.target.value }))} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="doc-avail">Availability</Label>
              <NativeSelect id="doc-avail" value={form.availability} onChange={(e) => setForm((f) => ({ ...f, availability: e.target.value as DoctorAvailability }))}>
                {AVAIL_OPTIONS.map((a) => <option key={a} value={a}>{a}</option>)}
              </NativeSelect>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="doc-phone">Contact Number</Label>
              <Input id="doc-phone" value={form.phone} onChange={(e) => setForm((f) => ({ ...f, phone: e.target.value }))} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="doc-email">Email</Label>
              <Input id="doc-email" type="email" value={form.email} onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))} />
            </div>
          </div>
          <div className="flex justify-end gap-2">
            <Button variant="secondary" onClick={() => setOpen(false)}>Cancel</Button>
            <Button onClick={submit} disabled={saving}>{saving ? "Saving…" : editId ? "Save Changes" : "Add Doctor"}</Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
