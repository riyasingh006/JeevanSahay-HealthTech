"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Eye, EyeOff, Hospital, UserRoundPlus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import authBackground from "@/components/landing/logo/doc.jpg";

function safeNext(raw: string | null): string {
  return raw && raw.startsWith("/") && !raw.startsWith("//") ? raw : "/dashboard";
}

function SignupForm() {
  const router = useRouter();
  const params = useSearchParams();
  const next = safeNext(params.get("next"));
  const [role, setRole] = React.useState<"PATIENT" | "HOSPITAL_ADMIN">("PATIENT");
  const [name, setName] = React.useState("");
  const [email, setEmail] = React.useState("");
  const [phone, setPhone] = React.useState("");
  const [password, setPassword] = React.useState("");
  const [confirmPassword, setConfirmPassword] = React.useState("");
  const [showPassword, setShowPassword] = React.useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = React.useState(false);
  const [hospitalName, setHospitalName] = React.useState("");
  const [registrationNumber, setRegistrationNumber] = React.useState("");
  const [hospitalType, setHospitalType] = React.useState("PRIVATE");
  const [addressLine, setAddressLine] = React.useState("");
  const [city, setCity] = React.useState("");
  const [state, setState] = React.useState("");
  const [pincode, setPincode] = React.useState("");
  const [website, setWebsite] = React.useState("");
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState("");

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    if (password !== confirmPassword) {
      setError("The passwords do not match.");
      return;
    }
    setLoading(true);
    try {
      const res = await fetch("/api/auth/register", {
        method: "POST",
        headers: { "Content-Type": "application/json", Accept: "application/json" },
        body: JSON.stringify({
          name,
          email,
          phone,
          password,
          role,
          ...(role === "HOSPITAL_ADMIN"
            ? { hospitalName, registrationNumber, hospitalType, addressLine, city, state, pincode, website }
            : {}),
        }),
      });
      const json = await res.json();
      if (!res.ok || !json.ok) {
        setError(json.error ?? "Unable to create your account. Please retry.");
        return;
      }
      const verifyUrl = new URLSearchParams({ email, role, next });
      if (json.data?.deliveryPending) verifyUrl.set("delivery", "pending");
      router.replace(`/verify-email?${verifyUrl.toString()}`);
    } catch {
      setError("Network problem — please check your connection and retry.");
    } finally {
      setLoading(false);
    }
  }

  const selectClass = "flex h-10 w-full rounded-lg border border-slate-300 bg-white px-3.5 py-2 text-sm text-ink shadow-sm focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-500/20";

  return (
    <div className="space-y-5">
      <div
        aria-hidden
        className="fixed inset-0 z-0 bg-cover bg-center bg-no-repeat"
        style={{
          backgroundImage: `linear-gradient(rgba(0, 31, 63, 0.08), rgba(0, 31, 63, 0.08)), url(${authBackground.src})`,
        }}
      />

      <div className="relative space-y-5">
        <div className="mx-auto w-full text-center">
          <h1 className="text-2xl font-bold text-primary-950">Create account</h1>
          <p className="mt-1 text-sm text-slate-600">
            {role === "PATIENT"
              ? "Register to save hospitals, track bed availability and manage your health profile."
              : "Submit your hospital details for review. Portal access is enabled after verification."}
          </p>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>{role === "PATIENT" ? "Patient registration" : "Hospital application"}</CardTitle>
            <CardDescription>All fields marked * are required. Email verification is required before activation.</CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={onSubmit} className="space-y-4">
              <div className="space-y-1.5">
                <Label htmlFor="account-role">Account type *</Label>
                <select
                  id="account-role"
                  className={selectClass}
                  value={role}
                  onChange={(e) => setRole(e.target.value as "PATIENT" | "HOSPITAL_ADMIN")}
                >
                  <option value="PATIENT">Patient</option>
                  <option value="HOSPITAL_ADMIN">Hospital — submit for verification</option>
                </select>
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="name">{role === "PATIENT" ? "Full name" : "Applicant full name"} *</Label>
                <Input
                  id="name"
                  required
                  minLength={2}
                  maxLength={80}
                  autoComplete="name"
                  placeholder="e.g. Riya Singh"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="email">Email address *</Label>
                <Input
                  id="email"
                  type="email"
                  required
                  maxLength={254}
                  autoComplete="email"
                  placeholder="you@example.in"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="phone">Phone number *</Label>
                <Input
                  id="phone"
                  type="tel"
                  required
                  minLength={7}
                  maxLength={24}
                  inputMode="tel"
                  autoComplete="tel"
                  placeholder="+91 …"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                />
              </div>

              {role === "HOSPITAL_ADMIN" && (
                <div className="space-y-4 rounded-xl border border-primary-100 bg-primary-50/60 p-4">
                  <div className="flex items-center gap-2 text-sm font-semibold text-primary-900">
                    <Hospital className="h-4 w-4" aria-hidden /> Hospital details for verification
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="hospital-name">Hospital name *</Label>
                    <Input id="hospital-name" required minLength={2} maxLength={120} value={hospitalName} onChange={(e) => setHospitalName(e.target.value)} />
                  </div>
                  <div className="grid gap-4 sm:grid-cols-2">
                    <div className="space-y-1.5">
                      <Label htmlFor="hospital-type">Hospital type *</Label>
                      <select id="hospital-type" className={selectClass} value={hospitalType} onChange={(e) => setHospitalType(e.target.value)}>
                        <option value="PRIVATE">Private</option>
                        <option value="GOVERNMENT">Government</option>
                        <option value="TRUST">Trust</option>
                        <option value="PSU">Public sector</option>
                      </select>
                    </div>
                    <div className="space-y-1.5">
                      <Label htmlFor="registration-number">Registration number</Label>
                      <Input id="registration-number" maxLength={80} value={registrationNumber} onChange={(e) => setRegistrationNumber(e.target.value)} />
                    </div>
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="hospital-address">Street address *</Label>
                    <Input id="hospital-address" required minLength={5} maxLength={200} autoComplete="street-address" value={addressLine} onChange={(e) => setAddressLine(e.target.value)} />
                  </div>
                  <div className="grid gap-4 sm:grid-cols-2">
                    <div className="space-y-1.5">
                      <Label htmlFor="hospital-city">City *</Label>
                      <Input id="hospital-city" required minLength={2} maxLength={80} autoComplete="address-level2" value={city} onChange={(e) => setCity(e.target.value)} />
                    </div>
                    <div className="space-y-1.5">
                      <Label htmlFor="hospital-state">State *</Label>
                      <Input id="hospital-state" required minLength={2} maxLength={80} autoComplete="address-level1" value={state} onChange={(e) => setState(e.target.value)} />
                    </div>
                    <div className="space-y-1.5">
                      <Label htmlFor="hospital-pincode">PIN code *</Label>
                      <Input id="hospital-pincode" required minLength={4} maxLength={12} inputMode="numeric" autoComplete="postal-code" value={pincode} onChange={(e) => setPincode(e.target.value)} />
                    </div>
                    <div className="space-y-1.5">
                      <Label htmlFor="hospital-website">Website</Label>
                      <Input id="hospital-website" type="url" maxLength={255} placeholder="https://…" value={website} onChange={(e) => setWebsite(e.target.value)} />
                    </div>
                  </div>
                </div>
              )}

              <div className="space-y-1.5">
                <Label htmlFor="password">Password *</Label>
                <div className="relative">
                  <Input
                    id="password"
                    type={showPassword ? "text" : "password"}
                    required
                    minLength={12}
                    maxLength={72}
                    autoComplete="new-password"
                    placeholder="At least 12 characters"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="pr-11"
                  />
                  <button type="button" onClick={() => setShowPassword((value) => !value)} aria-label={showPassword ? "Hide password" : "Show password"} className="absolute right-3 top-1/2 -translate-y-1/2 rounded p-1 text-slate-500 hover:text-primary-900">
                    {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
                <p className="text-xs text-slate-400">Use at least 12 characters, with upper-case, lower-case and numeric characters.</p>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="confirm-password">Confirm password *</Label>
                <div className="relative">
                  <Input
                    id="confirm-password"
                    type={showConfirmPassword ? "text" : "password"}
                    required
                    minLength={12}
                    maxLength={72}
                    autoComplete="new-password"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    className="pr-11"
                  />
                  <button type="button" onClick={() => setShowConfirmPassword((value) => !value)} aria-label={showConfirmPassword ? "Hide confirmation" : "Show confirmation"} className="absolute right-3 top-1/2 -translate-y-1/2 rounded p-1 text-slate-500 hover:text-primary-900">
                    {showConfirmPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
              </div>

              {error && (
                <p role="alert" className="rounded-lg border border-red-200 bg-red-50 px-3.5 py-2.5 text-xs font-medium text-red-700">
                  {error}
                </p>
              )}

              <Button type="submit" size="lg" className="w-full gap-2" loading={loading}>
                {role === "PATIENT" ? <UserRoundPlus className="h-4 w-4" aria-hidden /> : <Hospital className="h-4 w-4" aria-hidden />}
                {role === "PATIENT" ? "Create account" : "Submit hospital application"}
              </Button>
            </form>

            <p className="mt-4 text-center text-sm text-slate-600">
              Already registered?{" "}
              <Link href={`/login?next=${encodeURIComponent(next)}`} className="font-semibold text-care-700 hover:underline">
                Sign in
              </Link>
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

export default function SignupPage() {
  return (
    <React.Suspense fallback={<div className="h-96 animate-pulse rounded-xl bg-slate-200/70" />}>
      <SignupForm />
    </React.Suspense>
  );
}
