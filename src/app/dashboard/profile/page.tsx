"use client";

import * as React from "react";
import { Copy, KeyRound, Loader2, QrCode, Save, ShieldCheck } from "lucide-react";
import { QRCodeSVG } from "qrcode.react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/components/ui/toast";

interface Profile {
  name: string;
  email: string;
  phone: string | null;
  age: number | null;
  gender: string | null;
  location: string | null;
  bloodGroup: string | null;
  allergies: string | null;
  conditions: string | null;
  medications: string | null;
  emergencyName: string | null;
  emergencyRel: string | null;
  emergencyPhone: string | null;
  hasSharePin: boolean;
}

const BLOOD_GROUPS = ["A+", "A-", "B+", "B-", "AB+", "AB-", "O+", "O-"];

export default function MedicalProfilePage() {
  const [profile, setProfile] = React.useState<Profile | null>(null);
  const [form, setForm] = React.useState<Partial<Profile>>({});
  const [saving, setSaving] = React.useState(false);

  const [pinCurrent, setPinCurrent] = React.useState("");
  const [pinNew, setPinNew] = React.useState("");
  const [pinBusy, setPinBusy] = React.useState(false);
  const [shareUrl, setShareUrl] = React.useState<string | null>(null);
  const [shareBusy, setShareBusy] = React.useState(false);
  const { toast } = useToast();

  React.useEffect(() => {
    fetch("/api/user/profile", { cache: "no-store" })
      .then((r) => r.json())
      .then((json) => {
        if (json.ok) {
          setProfile(json.data.profile);
          setForm(json.data.profile);
        }
      })
      .catch(() => {});
  }, []);

  function set<K extends keyof Profile>(key: K, value: Profile[K]) {
    setForm((f) => ({ ...f, [key]: value }));
  }

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    try {
      const payload: Record<string, unknown> = {};
      for (const key of [
        "name", "phone", "age", "gender", "location", "bloodGroup",
        "allergies", "conditions", "medications",
        "emergencyName", "emergencyRel", "emergencyPhone",
      ] as const) {
        const v = form[key];
        if (v !== undefined && v !== null && String(v).trim() !== "") payload[key] = v;
      }
      const res = await fetch("/api/user/profile", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const json = await res.json();
      if (!json.ok) throw new Error(json.error ?? "Failed to save");
      setProfile((p) => (p ? { ...p, ...json.data.profile } : p));
      toast({ title: "Medical profile updated", variant: "success" });
    } catch (err) {
      toast({
        title: "Could not save profile",
        description: err instanceof Error ? err.message : undefined,
        variant: "error",
      });
    } finally {
      setSaving(false);
    }
  }

  async function rotatePin(e: React.FormEvent) {
    e.preventDefault();
    setPinBusy(true);
    try {
      const res = await fetch("/api/user/profile", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ currentPassword: pinCurrent, newPin: pinNew }),
      });
      const json = await res.json();
      if (!json.ok) throw new Error(json.error ?? "Failed to update PIN");
      setProfile((p) => (p ? { ...p, hasSharePin: true } : p));
      setPinCurrent("");
      setPinNew("");
      setShareUrl(null);
      toast({ title: "Health profile share PIN updated", variant: "success" });
    } catch (err) {
      toast({
        title: "Could not update PIN",
        description: err instanceof Error ? err.message : undefined,
        variant: "error",
      });
    } finally {
      setPinBusy(false);
    }
  }

  async function generateShareLink() {
    setShareBusy(true);
    try {
      const res = await fetch("/api/user/health-share", {
        method: "POST",
        cache: "no-store",
      });
      const json = await res.json();
      if (!res.ok || !json.ok) throw new Error(json.error ?? "Could not create a share link");
      setShareUrl(new URL(json.data.url, window.location.origin).toString());
    } catch (err) {
      toast({
        title: "Could not create a share link",
        description: err instanceof Error ? err.message : undefined,
        variant: "error",
      });
    } finally {
      setShareBusy(false);
    }
  }

  async function copyShareLink() {
    if (!shareUrl) return;
    try {
      await navigator.clipboard.writeText(shareUrl);
      toast({ title: "Secure share link copied", variant: "success" });
    } catch {
      toast({ title: "Could not copy link", description: "Use the QR code instead.", variant: "error" });
    }
  }


  if (!profile) {
    return (
      <div className="mx-auto max-w-3xl space-y-4">
        <Skeleton className="h-8 w-56" />
        <Skeleton className="h-72 w-full rounded-xl" />
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-3xl">
      <header>
        <h1 className="institutional-heading text-2xl">Medical Profile</h1>
        <p className="mt-1 text-sm text-slate-600">
          Private to you. Used to speed up appointments and emergency sharing.
        </p>
      </header>

      <form onSubmit={save} className="mt-5 space-y-6">
        {/* Personal */}
        <Card>
          <CardHeader className="pb-3"><CardTitle>Personal details</CardTitle></CardHeader>
          <CardContent className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="mp-name">Full name *</Label>
              <Input id="mp-name" required minLength={2} value={form.name ?? ""} onChange={(e) => set("name", e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="mp-email">Email</Label>
              <Input id="mp-email" value={profile.email} disabled aria-describedby="mp-email-hint" />
              <p id="mp-email-hint" className="text-[11px] text-slate-400">Signed in account — cannot be changed here.</p>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="mp-phone">Mobile number</Label>
              <Input id="mp-phone" type="tel" maxLength={16} value={form.phone ?? ""} onChange={(e) => set("phone", e.target.value)} placeholder="+91 …" />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label htmlFor="mp-age">Age</Label>
                <Input id="mp-age" type="number" min={0} max={120} value={form.age ?? ""} onChange={(e) => set("age", e.target.value === "" ? null : Number(e.target.value))} />
              </div>
              <div className="space-y-1.5">
                <Label>Gender</Label>
                <Select value={form.gender ?? undefined} onValueChange={(v) => set("gender", v)}>
                  <SelectTrigger className="w-full"><SelectValue placeholder="Select" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Male">Male</SelectItem>
                    <SelectItem value="Female">Female</SelectItem>
                    <SelectItem value="Other">Other</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="space-y-1.5 sm:col-span-2">
              <Label htmlFor="mp-city">City / Location</Label>
              <Input id="mp-city" value={form.location ?? ""} onChange={(e) => set("location", e.target.value)} placeholder="e.g. New Delhi" />
            </div>
          </CardContent>
        </Card>

        {/* Medical */}
        <Card>
          <CardHeader className="pb-3"><CardTitle>Medical information</CardTitle></CardHeader>
          <CardContent className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label>Blood group</Label>
              <Select value={form.bloodGroup ?? undefined} onValueChange={(v) => set("bloodGroup", v)}>
                <SelectTrigger className="w-full"><SelectValue placeholder="Select" /></SelectTrigger>
                <SelectContent>
                  {BLOOD_GROUPS.map((b) => (
                    <SelectItem key={b} value={b}>{b}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="mp-allergies">Allergies</Label>
              <Input id="mp-allergies" value={form.allergies ?? ""} onChange={(e) => set("allergies", e.target.value)} placeholder="e.g. Penicillin" />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="mp-cond">Chronic conditions</Label>
              <Input id="mp-cond" value={form.conditions ?? ""} onChange={(e) => set("conditions", e.target.value)} placeholder="e.g. Diabetes, Hypertension" />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="mp-meds">Current medications</Label>
              <Input id="mp-meds" value={form.medications ?? ""} onChange={(e) => set("medications", e.target.value)} placeholder="Optional" />
            </div>

            <fieldset className="sm:col-span-2">
              <legend className="data-label mb-2">Emergency contact</legend>
              <div className="grid gap-4 sm:grid-cols-3">
                <Input value={form.emergencyName ?? ""} onChange={(e) => set("emergencyName", e.target.value)} placeholder="Name" aria-label="Emergency contact name" />
                <Input value={form.emergencyRel ?? ""} onChange={(e) => set("emergencyRel", e.target.value)} placeholder="Relationship" aria-label="Emergency contact relationship" />
                <Input type="tel" maxLength={16} value={form.emergencyPhone ?? ""} onChange={(e) => set("emergencyPhone", e.target.value)} placeholder="Phone" aria-label="Emergency contact phone" />
              </div>
            </fieldset>
          </CardContent>
        </Card>

        <Button type="submit" size="lg" className="gap-2" disabled={saving}>
          {saving ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> : <Save className="h-4 w-4" aria-hidden />}
          Save profile
        </Button>
      </form>

      {/* Privacy */}
      <Card className="mt-8">
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2">
            <ShieldCheck className="h-4 w-4" aria-hidden /> Privacy &amp; health data sharing
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <p className="text-sm leading-relaxed text-slate-600">
            Your full medical information stays private. Only the limited emergency
            summary is shared through a short-lived PIN-protected link that you create.
          </p>
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant={profile.hasSharePin ? "green" : "neutral"} size="md">
              <KeyRound className="h-3 w-3" aria-hidden />{" "}
              {profile.hasSharePin ? "Digital Health Profile PIN is active" : "No share PIN set"}
            </Badge>
          </div>
          <form onSubmit={rotatePin} className="grid gap-3 sm:grid-cols-[1fr_1fr_auto] sm:items-end">
            <div className="space-y-1.5">
              <Label htmlFor="pin-cur">Current password</Label>
              <Input id="pin-cur" type="password" required value={pinCurrent} onChange={(e) => setPinCurrent(e.target.value)} autoComplete="current-password" />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="pin-new">New 6-digit share PIN</Label>
              <Input id="pin-new" required pattern="\d{6}" inputMode="numeric" maxLength={6} value={pinNew} onChange={(e) => setPinNew(e.target.value.replace(/\D/g, ""))} placeholder="••••••" />
            </div>
            <Button type="submit" variant="secondary" disabled={pinBusy || pinNew.length !== 6}>
              {profile.hasSharePin ? "Rotate PIN" : "Set PIN"}
            </Button>
          </form>
          <div className="border-t border-slate-100 pt-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <h3 className="text-sm font-semibold text-slate-900">Share a limited emergency summary</h3>
                <p className="mt-1 text-xs text-slate-500">Create a short-lived QR code or link that expires in 5 minutes. The recipient must enter your share PIN.</p>
              </div>
              <Button type="button" variant="secondary" disabled={!profile.hasSharePin || shareBusy} onClick={generateShareLink}>
                {shareBusy ? <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden /> : <QrCode className="mr-2 h-4 w-4" aria-hidden />}
                {shareUrl ? "Generate new link" : "Generate secure link"}
              </Button>
            </div>
            {!profile.hasSharePin && <p className="mt-2 text-xs text-amber-700">Set a share PIN above before creating a link.</p>}
            {shareUrl && (
              <div className="mt-4 flex flex-col items-center gap-3 rounded-lg border border-slate-200 bg-white p-4 sm:flex-row sm:items-center">
                <QRCodeSVG value={shareUrl} size={176} level="M" includeMargin aria-label="QR code for the limited emergency health summary" />
                <div className="space-y-2 text-center sm:text-left">
                  <p className="text-sm font-medium text-slate-800">Scan or copy this secure link</p>
                  <p className="max-w-md break-all text-xs text-slate-500">The link contains a short-lived access token, not your PIN. Share your PIN separately with the intended recipient.</p>
                  <Button type="button" size="sm" variant="secondary" onClick={copyShareLink}>
                    <Copy className="mr-2 h-3.5 w-3.5" aria-hidden /> Copy secure link
                  </Button>
                </div>
              </div>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
