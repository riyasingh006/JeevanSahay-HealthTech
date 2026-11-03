"use client";

import * as React from "react";
import { Building2, Edit2, Save } from "lucide-react";
import { useHospitalPortal } from "@/components/hospital/hospital-store";
import {
  LiveRecordsNotice,
  PageHeader,
  SectionCard,
} from "@/components/hospital/hospital-ui";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/input";
import { useToast } from "@/components/ui/toast";

export default function HospitalProfilePage() {
  const { profile, departments, services, updateProfile } = useHospitalPortal();
  const { toast } = useToast();
  const [editing, setEditing] = React.useState(false);
  const [saving, setSaving] = React.useState(false);
  const [form, setForm] = React.useState(profile);

  React.useEffect(() => setForm(profile), [profile]);

  async function save() {
    setSaving(true);
    const result = await updateProfile(form);
    setSaving(false);
    if (!result.ok) {
      toast({ title: "Could not save profile", description: result.error, variant: "error" });
      return;
    }
    setEditing(false);
    toast({ title: "Profile updated", description: "Hospital contact and profile details were saved.", variant: "success" });
  }

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Hospital Management"
        title="Hospital Profile"
        description="View and edit hospital details using live data."
        icon={Building2}
        actions={
          editing ? (
            <div className="flex gap-2">
              <Button variant="secondary" size="sm" onClick={() => { setForm(profile); setEditing(false); }}>Cancel</Button>
              <Button size="sm" className="gap-1.5" onClick={save} disabled={saving}><Save className="h-3.5 w-3.5" aria-hidden />{saving ? "Saving…" : "Save"}</Button>
            </div>
          ) : (
            <Button size="sm" className="gap-1.5" onClick={() => setEditing(true)}><Edit2 className="h-3.5 w-3.5" aria-hidden />Edit Profile</Button>
          )
        }
      />

      <LiveRecordsNotice>
        Verified hospital name, type, and registration number cannot be changed here. Contact details and descriptive information can be updated by an authorised hospital administrator.
      </LiveRecordsNotice>

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <SectionCard title="General Information" description="Hospital identity and contact details">
            <div className="grid gap-3 md:grid-cols-2">
              <div className="space-y-1.5 md:col-span-2">
                <Label htmlFor="hp-name">Hospital Name</Label>
                <Input id="hp-name" value={form.name} disabled />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="hp-type">Type</Label>
                <Input id="hp-type" value={form.type} disabled />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="hp-reg">Registration Number</Label>
                <Input id="hp-reg" value={form.registrationNumber} disabled />
              </div>
              <div className="space-y-1.5 md:col-span-2">
                <Label htmlFor="hp-addr">Address</Label>
                <Input id="hp-addr" value={form.addressLine} disabled={!editing} onChange={(e) => setForm((f) => ({ ...f, addressLine: e.target.value }))} />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="hp-city">City</Label>
                <Input id="hp-city" value={form.city} disabled={!editing} onChange={(e) => setForm((f) => ({ ...f, city: e.target.value }))} />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="hp-state">State</Label>
                <Input id="hp-state" value={form.state} disabled={!editing} onChange={(e) => setForm((f) => ({ ...f, state: e.target.value }))} />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="hp-pin">Pincode</Label>
                <Input id="hp-pin" value={form.pincode} disabled={!editing} onChange={(e) => setForm((f) => ({ ...f, pincode: e.target.value }))} />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="hp-phone">Phone</Label>
                <Input id="hp-phone" value={form.phone} disabled={!editing} onChange={(e) => setForm((f) => ({ ...f, phone: e.target.value }))} />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="hp-emerg">Emergency Phone</Label>
                <Input id="hp-emerg" value={form.emergencyPhone} disabled={!editing} onChange={(e) => setForm((f) => ({ ...f, emergencyPhone: e.target.value }))} />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="hp-email">Email</Label>
                <Input id="hp-email" value={form.email} disabled={!editing} onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))} />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="hp-web">Website</Label>
                <Input id="hp-web" value={form.website} disabled={!editing} onChange={(e) => setForm((f) => ({ ...f, website: e.target.value }))} />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="hp-acc">Accreditation</Label>
                <Input id="hp-acc" value={form.accreditation} disabled={!editing} onChange={(e) => setForm((f) => ({ ...f, accreditation: e.target.value }))} />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="hp-est">Established</Label>
                <Input id="hp-est" type="number" value={form.established} disabled={!editing} onChange={(e) => setForm((f) => ({ ...f, established: Number(e.target.value) }))} />
              </div>
              <div className="space-y-1.5 md:col-span-2">
                <Label htmlFor="hp-about">About</Label>
                <Textarea id="hp-about" value={form.about} disabled={!editing} onChange={(e) => setForm((f) => ({ ...f, about: e.target.value }))} />
              </div>
            </div>
          </SectionCard>
        </div>
        <div className="space-y-4">
          <Card className="shadow-card">
            <CardContent className="p-4">
              <p className="text-sm font-semibold text-primary-950">Departments & Services Summary</p>
              <div className="mt-3 space-y-2">
                <div className="flex items-center justify-between text-sm"><span className="text-slate-600">Departments</span><span className="tabular-nums font-medium">{departments.length}</span></div>
                <div className="flex items-center justify-between text-sm"><span className="text-slate-600">Services</span><span className="tabular-nums font-medium">{services.length}</span></div>
              </div>
              <div className="mt-3 flex flex-wrap gap-1.5">
                {departments.slice(0, 6).map((d) => <span key={d.id} className="rounded-full bg-primary-50 px-2 py-1 text-[11px] text-primary-700">{d.name}</span>)}
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
