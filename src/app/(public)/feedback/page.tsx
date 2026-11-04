"use client";

import * as React from "react";
import Link from "next/link";
import { ArrowLeft, CircleCheck, MessageSquareText, ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input, Textarea } from "@/components/ui/input";

type Delivery = "sent" | "not_configured" | "failed" | "no_recipients";
type Result = { reportId: string; emailDelivery: Delivery };

const categories = [
  ["DATA_ISSUE", "Incorrect directory information"],
  ["FACILITY", "Hospital or facility"],
  ["STAFF", "Staff or service"],
  ["BILLING", "Billing"],
  ["OTHER", "Other feedback"],
] as const;

export default function FeedbackPage() {
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState("");
  const [result, setResult] = React.useState<Result | null>(null);

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setBusy(true);
    const formElement = event.currentTarget;
    const form = new FormData(formElement);
    const payload = Object.fromEntries([...form.entries()].map(([key, value]) => [key, String(value).trim()]));
    for (const key of ["reporterName", "contactEmail", "relatedHospital"]) {
      if (!payload[key]) delete payload[key];
    }
    try {
      const response = await fetch("/api/reports", {
        method: "POST",
        headers: { "Content-Type": "application/json", Accept: "application/json" },
        body: JSON.stringify(payload),
      });
      const body = await response.json().catch(() => null);
      if (!response.ok || !body?.ok) throw new Error(body?.error || "We could not submit your message. Please try again.");
      setResult(body.data as Result);
      formElement.reset();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "We could not submit your message. Please try again.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="container max-w-4xl py-10 sm:py-14">
      <Link href="/" className="inline-flex items-center gap-2 text-sm font-medium text-primary-700 hover:text-primary-900">
        <ArrowLeft className="h-4 w-4" aria-hidden /> Back to home
      </Link>
      <div className="mt-6 grid gap-8 md:grid-cols-[minmax(0,1.35fr)_minmax(240px,0.65fr)]">
        <Card>
          <CardHeader>
            <div className="mb-2 flex h-11 w-11 items-center justify-center rounded-xl bg-primary-50 text-primary-700"><MessageSquareText className="h-5 w-5" aria-hidden /></div>
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-saffron-700">Feedback & complaints</p>
            <CardTitle className="text-2xl">Tell us what needs attention</CardTitle>
            <CardDescription>Messages are stored securely for the Jeevan Sahay administration team to review.</CardDescription>
          </CardHeader>
          <CardContent>
            {result ? (
              <div role="status" className="rounded-xl border border-green-200 bg-green-50 p-5 text-green-950">
                <CircleCheck className="h-6 w-6 text-green-700" aria-hidden />
                <h2 className="mt-3 font-semibold">Your message has been recorded</h2>
                <p className="mt-1 text-sm">Reference: <span className="font-mono">{result.reportId}</span>. The report is in the review queue. You can send another message below.</p>
                {result.emailDelivery !== "sent" && <p className="mt-2 text-sm">Email notification may be unavailable, but your report remains saved for review.</p>}
                <Button className="mt-4" variant="secondary" onClick={() => setResult(null)}>Send another message</Button>
              </div>
            ) : (
              <form onSubmit={submit} className="space-y-4">
                <div className="grid gap-4 sm:grid-cols-2">
                  <label className="space-y-1.5 text-sm font-medium text-primary-950">Category
                    <select name="category" required defaultValue="OTHER" className="h-10 w-full rounded-lg border border-slate-300 bg-white px-3 text-sm font-normal text-slate-800 focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-500/20">
                      {categories.map(([value, label]) => <option key={value} value={value}>{label}</option>)}
                    </select>
                  </label>
                  <label className="space-y-1.5 text-sm font-medium text-primary-950">Related hospital <span className="font-normal text-slate-500">(optional)</span>
                    <Input name="relatedHospital" maxLength={120} placeholder="Hospital or facility name" />
                  </label>
                </div>
                <label className="block space-y-1.5 text-sm font-medium text-primary-950">Subject
                  <Input name="subject" required minLength={4} maxLength={120} placeholder="A short summary" />
                </label>
                <label className="block space-y-1.5 text-sm font-medium text-primary-950">What happened?
                  <Textarea name="message" required minLength={10} maxLength={2000} rows={6} placeholder="Describe the issue. Please do not include medical records or other sensitive health information." />
                </label>
                <div className="grid gap-4 sm:grid-cols-2">
                  <label className="space-y-1.5 text-sm font-medium text-primary-950">Your name <span className="font-normal text-slate-500">(optional)</span>
                    <Input name="reporterName" maxLength={80} autoComplete="name" />
                  </label>
                  <label className="space-y-1.5 text-sm font-medium text-primary-950">Email for a status update <span className="font-normal text-slate-500">(optional)</span>
                    <Input name="contactEmail" type="email" maxLength={254} autoComplete="email" />
                  </label>
                </div>
                {error && <p role="alert" className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800">{error}</p>}
                <Button type="submit" loading={busy} className="w-full sm:w-auto">Submit for review</Button>
              </form>
            )}
          </CardContent>
        </Card>
        <aside className="space-y-4">
          <Card className="bg-primary-50/70">
            <CardContent className="pt-5">
              <ShieldCheck className="h-6 w-6 text-primary-700" aria-hidden />
              <h2 className="mt-3 font-semibold text-primary-950">Share only what is needed</h2>
              <p className="mt-2 text-sm leading-relaxed text-slate-600">Please do not include medical records, passwords, one-time codes, or other sensitive health information. A contact email is optional.</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-5">
              <h2 className="font-semibold text-primary-950">Need urgent help?</h2>
              <p className="mt-2 text-sm leading-relaxed text-slate-600">This form is not monitored for emergencies and does not dispatch care. Call India’s emergency number <a className="font-semibold text-red-700 underline" href="tel:112">112</a> for urgent assistance.</p>
            </CardContent>
          </Card>
        </aside>
      </div>
    </div>
  );
}
