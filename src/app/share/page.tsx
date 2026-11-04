"use client";

import * as React from "react";
import { AlertTriangle, HeartPulse, Loader2, ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

interface HealthSummary {
  name: string;
  age: number | null;
  gender: string | null;
  bloodGroup: string | null;
  allergies: string | null;
  conditions: string | null;
  medications: string | null;
  emergencyName: string | null;
  emergencyRel: string | null;
  emergencyPhone: string | null;
}

export default function HealthSharePage() {
  const [token, setToken] = React.useState("");
  const [ready, setReady] = React.useState(false);
  const [pin, setPin] = React.useState("");
  const [summary, setSummary] = React.useState<HealthSummary | null>(null);
  const [error, setError] = React.useState("");
  const [submitting, setSubmitting] = React.useState(false);

  React.useEffect(() => {
    const value = window.location.hash.slice(1);
    window.history.replaceState(window.history.state, "", window.location.pathname);
    if (value.length > 0 && value.length <= 4096) setToken(value);
    else setError("This health-share link is missing or invalid. Ask the patient to create a new one.");
    setReady(true);
  }, []);

  async function resolve(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!token || pin.length !== 6 || submitting) return;
    setSubmitting(true);
    setError("");
    try {
      const response = await fetch("/api/user/health-share/resolve", {
        method: "POST",
        headers: { "Content-Type": "application/json", Accept: "application/json" },
        body: JSON.stringify({ token, pin }),
        cache: "no-store",
        credentials: "omit",
      });
      const result = await response.json();
      if (!response.ok || !result.ok) throw new Error(result.error ?? "Could not verify this health-share link.");
      setSummary(result.data.summary as HealthSummary);
      setPin("");
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not verify this health-share link.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-slate-50 px-4 py-10 text-slate-900">
      <div className="w-full max-w-xl space-y-4">
        <div className="text-center">
          <span className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-teal-50 text-teal-700">
            <HeartPulse className="h-6 w-6" aria-hidden />
          </span>
          <h1 className="mt-3 text-2xl font-semibold tracking-tight">Digital Health Profile</h1>
          <p className="mt-1 text-sm text-slate-600">A patient has shared a limited medical summary for care purposes.</p>
        </div>

        {!summary ? (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-lg"><ShieldCheck className="h-5 w-5 text-teal-700" aria-hidden /> Verify access</CardTitle>
              <CardDescription>Enter the patient’s 6-digit share PIN. It is sent in the POST request body and is never added to this link.</CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={resolve} className="space-y-4">
                <div className="space-y-1.5">
                  <Label htmlFor="share-pin">6-digit share PIN</Label>
                  <Input
                    id="share-pin"
                    type="password"
                    inputMode="numeric"
                    autoComplete="off"
                    pattern="[0-9]{6}"
                    maxLength={6}
                    value={pin}
                    onChange={(event) => setPin(event.target.value.replace(/\D/g, "").slice(0, 6))}
                    required
                    disabled={!ready || !token || submitting}
                    aria-describedby={error ? "share-error" : undefined}
                  />
                </div>
                {error && <p id="share-error" role="alert" className="text-sm text-red-700">{error}</p>}
                <Button type="submit" className="w-full" disabled={!ready || !token || pin.length !== 6 || submitting}>
                  {submitting ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden /> Checking…</> : "View shared summary"}
                </Button>
              </form>
              <p className="mt-4 text-xs leading-relaxed text-slate-500">This link expires after five minutes. Only the patient’s limited emergency summary is shown; account email and login details are not shared.</p>
            </CardContent>
          </Card>
        ) : (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-lg"><ShieldCheck className="h-5 w-5 text-teal-700" aria-hidden /> Shared medical summary</CardTitle>
              <CardDescription>Use this information only to support the patient’s care.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <dl className="grid gap-3 sm:grid-cols-2">
                <SummaryItem label="Name" value={summary.name} />
                <SummaryItem label="Age" value={summary.age == null ? null : String(summary.age)} />
                <SummaryItem label="Gender" value={summary.gender} />
                <SummaryItem label="Blood group" value={summary.bloodGroup} />
                <SummaryItem label="Allergies" value={summary.allergies} />
                <SummaryItem label="Conditions" value={summary.conditions} />
                <SummaryItem label="Medications" value={summary.medications} />
                <SummaryItem label="Emergency contact" value={summary.emergencyName ? `${summary.emergencyName}${summary.emergencyRel ? ` (${summary.emergencyRel})` : ""}${summary.emergencyPhone ? ` · ${summary.emergencyPhone}` : ""}` : null} />
              </dl>
              <div className="flex gap-2 rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">
                <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
                <p>Confirm details with the patient where possible. This is patient-provided information, not a substitute for clinical assessment.</p>
              </div>
              {error && <p role="alert" className="text-sm text-red-700">{error}</p>}
            </CardContent>
          </Card>
        )}
        <p className="text-center text-xs text-slate-500">Jeevan Sahay · Private health information</p>
      </div>
    </main>
  );
}

function SummaryItem({ label, value }: { label: string; value: string | null }) {
  return (
    <div className="min-w-0 rounded-lg border border-slate-200 p-3">
      <dt className="text-xs font-medium uppercase tracking-wide text-slate-500">{label}</dt>
      <dd className="mt-1 break-words text-sm text-slate-900">{value || "Not provided"}</dd>
    </div>
  );
}
