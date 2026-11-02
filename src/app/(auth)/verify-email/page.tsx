"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { ArrowLeft, MailCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useAuth } from "@/components/auth-context";

function safeNext(raw: string | null): string {
  return raw && raw.startsWith("/") && !raw.startsWith("//") ? raw : "/dashboard";
}

function VerifyEmailForm() {
  const params = useSearchParams();
  const router = useRouter();
  const { refresh } = useAuth();
  const [email, setEmail] = React.useState(params.get("email") ?? "");
  const [code, setCode] = React.useState("");
  const [role] = React.useState(params.get("role") === "HOSPITAL_ADMIN" ? "HOSPITAL_ADMIN" : "PATIENT");
  const [next] = React.useState(safeNext(params.get("next")));
  const [seconds, setSeconds] = React.useState(params.get("delivery") === "pending" ? 0 : 60);
  const [loading, setLoading] = React.useState(false);
  const [resending, setResending] = React.useState(false);
  const [verified, setVerified] = React.useState(false);
  const [message, setMessage] = React.useState(
    params.get("delivery") === "pending"
      ? "Your account is saved, but we could not confirm email delivery. Check your mail settings, then request a new code."
      : "Enter the six-digit code we sent to your email. It expires after five minutes."
  );
  const [error, setError] = React.useState("");

  React.useEffect(() => {
    if (seconds <= 0) return;
    const timer = window.setInterval(() => setSeconds((value) => Math.max(0, value - 1)), 1000);
    return () => window.clearInterval(timer);
  }, [seconds]);

  async function submitCode(event: React.FormEvent) {
    event.preventDefault();
    setError("");
    setLoading(true);
    try {
      const response = await fetch("/api/auth/verify-email", {
        method: "POST",
        headers: { "Content-Type": "application/json", Accept: "application/json" },
        body: JSON.stringify({ email, code }),
      });
      const result = await response.json();
      if (!response.ok || !result.ok) {
        setError(result.error ?? "That code could not be verified.");
        return;
      }
      if (result.hospitalApplicationPending) {
        setVerified(true);
        setMessage("Your email is verified. Your hospital application is now waiting for an administrator to review it; portal access is not available until approval.");
        return;
      }
      await refresh();
      router.replace(next);
    } catch {
      setError("Network problem — please check your connection and retry.");
    } finally {
      setLoading(false);
    }
  }

  async function resendCode() {
    setError("");
    setResending(true);
    try {
      const response = await fetch("/api/auth/resend-verification", {
        method: "POST",
        headers: { "Content-Type": "application/json", Accept: "application/json" },
        body: JSON.stringify({ email }),
      });
      const result = await response.json();
      if (!response.ok || !result.ok) {
        setError(result.error ?? "We could not process the resend request.");
        return;
      }
      setMessage(result.message);
      setSeconds(60);
    } catch {
      setError("Network problem — please check your connection and retry.");
    } finally {
      setResending(false);
    }
  }

  return (
    <div className="mx-auto w-full max-w-lg">
      <Card>
        <CardHeader className="text-center">
          <div className="mx-auto mb-2 flex h-12 w-12 items-center justify-center rounded-full bg-primary-50 text-primary-800">
            <MailCheck className="h-6 w-6" aria-hidden />
          </div>
          <CardTitle>{verified ? "Email verified" : "Verify your email"}</CardTitle>
          <CardDescription>{message}</CardDescription>
        </CardHeader>
        <CardContent>
          {verified ? (
            <div className="space-y-4">
              <div role="status" className="rounded-lg border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-900">
                Application status: awaiting administrator review.
              </div>
              <Button asChild className="w-full">
                <Link href="/login">Return to sign in</Link>
              </Button>
            </div>
          ) : (
            <form onSubmit={submitCode} className="space-y-4">
              <div className="space-y-1.5">
                <Label htmlFor="email">Email address</Label>
                <Input id="email" type="email" required maxLength={254} autoComplete="email" value={email} onChange={(event) => setEmail(event.target.value)} />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="verification-code">Six-digit verification code</Label>
                <Input
                  id="verification-code"
                  required
                  inputMode="numeric"
                  autoComplete="one-time-code"
                  pattern="[0-9]{6}"
                  maxLength={6}
                  value={code}
                  onChange={(event) => setCode(event.target.value.replace(/\D/g, "").slice(0, 6))}
                  className="text-center text-xl tracking-[0.45em]"
                />
              </div>
              {error && <p role="alert" className="rounded-lg border border-red-200 bg-red-50 px-3.5 py-2.5 text-sm text-red-700">{error}</p>}
              <Button type="submit" className="w-full" loading={loading}>Verify email</Button>
              <div className="flex flex-col items-center gap-3 text-sm">
                <button type="button" onClick={resendCode} disabled={seconds > 0 || resending || !email} className="font-medium text-primary-800 disabled:cursor-not-allowed disabled:text-slate-400">
                  {resending ? "Requesting…" : seconds > 0 ? `Resend code in ${seconds}s` : "Resend verification code"}
                </button>
                <Link href="/signup" className="inline-flex items-center gap-1.5 text-slate-600 hover:text-primary-800">
                  <ArrowLeft className="h-3.5 w-3.5" aria-hidden /> Back to registration
                </Link>
              </div>
            </form>
          )}
        </CardContent>
      </Card>
      <p className="mt-4 text-center text-sm text-slate-600">
        Already verified? <Link href="/login" className="font-semibold text-care-700 hover:underline">Sign in</Link>
      </p>
    </div>
  );
}

export default function VerifyEmailPage() {
  return (
    <React.Suspense fallback={<div className="h-96 animate-pulse rounded-xl bg-slate-200/70" />}>
      <div className="mx-auto w-full max-w-3xl px-4 py-12"><VerifyEmailForm /></div>
    </React.Suspense>
  );
}
