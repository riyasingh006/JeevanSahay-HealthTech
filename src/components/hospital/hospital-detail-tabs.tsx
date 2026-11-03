"use client";

import * as React from "react";
import {
  BedDouble,
  FlaskConical,
  PhoneCall,
  Siren,
  Stethoscope,
  Star,
  Users,
} from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge, LastUpdated, StatusBadge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { EmptyState } from "@/components/ui/empty-state";
import { useToast } from "@/components/ui/toast";
import { useAuth } from "@/components/auth-context";
import { BED_CATEGORIES, SERVICE_CATALOG, SPECIALTIES } from "@/lib/constants";

interface Bed {
  category: string;
  total: number;
  available: number;
}
interface Svc {
  key: string;
  status: string;
}
interface Doc {
  id: string;
  name: string;
  specialty: string;
  department?: string | null;
  qualification?: string | null;
  experienceYears: number;
  availability: string;
  timings?: string | null;
  languages?: string | null;
}
interface Rev {
  id: string;
  name: string;
  rating: number;
  comment: string;
  createdAt: string;
}

export function HospitalDetailTabs({
  hospital,
  distanceKm,
  etaMinutes,
  doctors,
  reviews,
}: {
  hospital: {
    id: string;
    name: string;
    about: string | null;
    accreditation: string | null;
    established: number | null;
    type: string;
    phone: string;
    emergencyPhone: string | null;
    addressLine: string;
    city: string;
    state: string;
    pincode: string;
    email: string | null;
    website: string | null;
    beds: Bed[];
    services: Svc[];
    lastAvailabilityUpdate: string | Date;
  };
  distanceKm: number;
  etaMinutes: number;
  stale?: boolean;
  doctors: Doc[];
  reviews: Rev[];
}) {
  const [localReviews, setLocalReviews] = React.useState(reviews);
  const { user } = useAuth();
  const { toast } = useToast();

  const submitReview = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!user) {
      toast({
        title: "Login required",
        description: "Please sign in to share your experience.",
        variant: "info",
      });
      return;
    }
    const form = new FormData(e.currentTarget);
    try {
      const res = await fetch(`/api/hospitals/${hospital.id}/reviews`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          rating: Number(form.get("rating")),
          comment: form.get("comment"),
        }),
      });
      const json = await res.json();
      if (!json.ok) throw new Error(json.error);
      setLocalReviews((prev) => [
        {
          id: json.data.review.id,
          name: user.name?.trim() || user.email || "Anonymous",
          rating: json.data.review.rating,
          comment: json.data.review.comment,
          createdAt: new Date().toISOString(),
        },
        ...prev,
      ]);
      e.currentTarget.reset();
      toast({ title: "Thank you — review published", variant: "success" });
    } catch (err) {
      toast({
        title: "Could not publish review",
        description: err instanceof Error ? err.message : undefined,
        variant: "error",
      });
    }
  };

  return (
    <Tabs defaultValue="overview">
      <TabsList aria-label="Hospital information sections">
        <TabsTrigger value="overview">Overview</TabsTrigger>
        <TabsTrigger value="departments">Departments</TabsTrigger>
        <TabsTrigger value="doctors">
          Doctors
          <Badge variant="primary" size="sm">{doctors.length}</Badge>
        </TabsTrigger>
        <TabsTrigger value="beds">Bed Availability</TabsTrigger>
        <TabsTrigger value="services">Services</TabsTrigger>
        <TabsTrigger value="emergency">Emergency</TabsTrigger>
        <TabsTrigger value="reviews">Reviews</TabsTrigger>
      </TabsList>

      {/* ---------------- Overview ---------------- */}
      <TabsContent value="overview">
        <div className="grid gap-5 lg:grid-cols-[1.4fr_1fr]">
          <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-card">
            <h3 className="text-sm font-bold uppercase tracking-wider text-primary-900">About the facility</h3>
            <p className="mt-2.5 leading-relaxed text-slate-600">
              {hospital.about ?? "No description provided by the facility."}
            </p>
            <dl className="mt-5 grid gap-4 border-t border-slate-100 pt-5 sm:grid-cols-3">
              {[
                ["Established", hospital.established?.toString() ?? "—"],
                ["Accreditation", hospital.accreditation ?? "—"],
                ["Hospital type", hospital.type],
                ["Distance", `${distanceKm} km`],
                ["Est. travel time", `${etaMinutes} min`],
                ["Emergency line", hospital.emergencyPhone ?? "—"],
              ].map(([k, v]) => (
                <div key={k}>
                  <dt className="data-label">{k}</dt>
                  <dd className="mt-0.5 text-sm font-semibold text-primary-900">{v}</dd>
                </div>
              ))}
            </dl>
          </div>

          <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-card">
            <h3 className="text-sm font-bold uppercase tracking-wider text-primary-900">Contact & location</h3>
            <address className="mt-2.5 space-y-1.5 not-italic leading-relaxed text-slate-600">
              <p>{hospital.addressLine}</p>
              <p>
                {hospital.city}, {hospital.state} — {hospital.pincode}
              </p>
              <p>
                <a className="font-medium text-care-600 hover:underline" href={`tel:${hospital.phone.replace(/\s/g, "")}`}>
                  {hospital.phone}
                </a>
              </p>
              {hospital.email && <p className="text-xs text-slate-500">{hospital.email}</p>}
              {hospital.website && (
                <p className="text-xs">
                  <span className="text-slate-400">{hospital.website.replace(/^https?:\/\//, "")}</span>
                </p>
              )}
            </address>
            <LastUpdated at={hospital.lastAvailabilityUpdate} prefix="Availability" className="mt-4" />
          </div>
        </div>
      </TabsContent>

      {/* ---------------- Departments ---------------- */}
      <TabsContent value="departments">
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {[...new Set(doctors.map((d) => d.specialty))].map((sp) => {
            const spec = SPECIALTIES.find((s) => s.key === sp);
            const docs = doctors.filter((d) => d.specialty === sp);
            return (
              <div key={sp} className="flex items-start gap-3 rounded-xl border border-slate-200 bg-white p-5 shadow-card">
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary-50">
                  <Stethoscope className="h-5 w-5 text-primary-700" aria-hidden />
                </span>
                <div>
                  <p className="font-semibold text-primary-900">{spec?.label ?? sp}</p>
                  <p className="mt-0.5 text-xs text-slate-500">
                    {docs.length} specialist{docs.length !== 1 ? "s" : ""} ·{" "}
                    {docs.some((d) => d.availability === "AVAILABLE")
                      ? "Available"
                      : docs.some((d) => d.availability === "LIMITED")
                        ? "Limited slots"
                        : "Unavailable"}
                  </p>
                </div>
              </div>
            );
          })}
        </div>
      </TabsContent>

      {/* ---------------- Doctors ---------------- */}
      <TabsContent value="doctors">
        {doctors.length === 0 ? (
          <EmptyState icon={<Users className="h-5 w-5" />} title="Doctor directory not yet published" />
        ) : (
          <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-card">
            <ul className="divide-y divide-slate-100">
              {doctors.map((d) => (
                <li key={d.id} className="flex flex-wrap items-center gap-4 px-5 py-4">
                  <span className="flex h-11 w-11 items-center justify-center rounded-full bg-primary-100 text-sm font-bold text-primary-800">
                    {d.name.replace(/^Dr\.?\s+/i, "").slice(0, 2).toUpperCase()}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="font-semibold text-primary-900">{d.name}</p>
                    <p className="text-xs text-slate-500">
                      {d.qualification} · {d.experienceYears} yrs ·{" "}
                      {SPECIALTIES.find((s) => s.key === d.specialty)?.label ?? d.specialty}
                    </p>
                  </div>
                  <div className="hidden text-right md:block">
                    <p className="text-xs text-slate-500">{d.timings}</p>
                    <p className="text-[11px] text-slate-400">{d.languages}</p>
                  </div>
                  <StatusBadge status={d.availability} />
                </li>
              ))}
            </ul>
          </div>
        )}
      </TabsContent>

      {/* ---------------- Beds ---------------- */}
      <TabsContent value="beds">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
          <p className="text-sm text-slate-600">Facility-reported resources</p>
          <LastUpdated at={hospital.lastAvailabilityUpdate} prefix="Availability" />
        </div>
        <BedCards beds={hospital.beds} />
      </TabsContent>

      {/* ---------------- Services ---------------- */}
      <TabsContent value="services">
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {SERVICE_CATALOG.map((svc) => {
            const s = hospital.services.find((x) => x.key === svc.key);
            return (
              <div key={svc.key} className="flex items-center justify-between rounded-xl border border-slate-200 bg-white px-5 py-4 shadow-card">
                <div className="flex items-center gap-3">
                  <FlaskConical className="h-4.5 w-4.5 text-care-600" aria-hidden />
                  <span className="text-sm font-medium text-primary-900">{svc.label}</span>
                </div>
                <StatusBadge status={s?.status ?? "UNAVAILABLE"} />
              </div>
            );
          })}
        </div>
      </TabsContent>

      {/* ---------------- Emergency ---------------- */}
      <TabsContent value="emergency">
        <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-card">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <h3 className="flex items-center gap-2 text-base font-semibold text-primary-900">
                <Siren className="h-5 w-5 text-red-600" aria-hidden /> Emergency readiness
              </h3>
              <div className="mt-4 flex flex-wrap gap-2">
                <StatusBadge status={hospital.services.find((s) => s.key === "EMERGENCY")?.status ?? "UNAVAILABLE"} label={`Emergency dept. ${hospital.services.find((s) => s.key === "EMERGENCY")?.status ?? "UNKNOWN"}`} />
                <StatusBadge status={hospital.services.find((s) => s.key === "AMBULANCE")?.status ?? "UNAVAILABLE"} label={`Ambulance ${hospital.services.find((s) => s.key === "AMBULANCE")?.status ?? "UNKNOWN"}`} />
              </div>
            </div>
            {hospital.emergencyPhone ? (
              <a href={`tel:${hospital.emergencyPhone.replace(/\s/g, "")}`}>
                <Button variant="emergency" size="lg">
                  <PhoneCall className="h-4.5 w-4.5" aria-hidden /> Call Emergency Line
                </Button>
              </a>
            ) : (
              <Button variant="emergency" size="lg" disabled>
                <PhoneCall className="h-4.5 w-4.5" aria-hidden /> Emergency line unavailable
              </Button>
            )}
          </div>
          <div className="mt-6 grid gap-4 sm:grid-cols-2">
            <BedCards beds={hospital.beds.filter((b) => ["EMERGENCY", "ICU", "VENTILATOR"].includes(b.category))} compact />
            <div className="rounded-lg bg-paper p-4 text-sm leading-relaxed text-slate-600">
              In a life-threatening situation always call{" "}
              <a href="tel:112" className="font-bold text-red-700 hover:underline">
                112
              </a>{" "}
              (national emergency) or{" "}
              <a href="tel:108" className="font-bold text-red-700 hover:underline">
                108
              </a>{" "}
              (ambulance) first. This page is informational and may not reflect
              live operational capacity.
            </div>
          </div>
        </div>
      </TabsContent>

      {/* ---------------- Reviews ---------------- */}
      <TabsContent value="reviews">
        <div className="grid gap-5 lg:grid-cols-[1.3fr_1fr]">
          <div className="space-y-4">
            {localReviews.length === 0 ? (
              <EmptyState icon={<Star className="h-5 w-5" />} title="No reviews yet" description="Be the first to share your experience with this facility." />
            ) : (
              localReviews.map((r) => (
                <article key={r.id} className="rounded-xl border border-slate-200 bg-white p-5 shadow-card">
                  <div className="flex items-center justify-between">
                    <p className="font-semibold text-primary-900">{r.name}</p>
                    <Stars value={r.rating} />
                  </div>
                  <p className="mt-2 text-sm leading-relaxed text-slate-600">{r.comment}</p>
                  <p className="mt-2 text-xs text-slate-400">
                    {new Date(r.createdAt).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })}
                  </p>
                </article>
              ))
            )}
          </div>

          <form onSubmit={submitReview} className="h-fit rounded-xl border border-slate-200 bg-white p-5 shadow-card">
            <h3 className="text-sm font-bold uppercase tracking-wider text-primary-900">Share your experience</h3>
            {!user && (
              <p className="mt-2 rounded-md bg-status-info-bg px-3 py-2 text-xs text-status-info-fg">
                You need to be signed in to post a review.
              </p>
            )}
            <div className="mt-3 space-y-3">
              <div>
                <Label htmlFor="rev-rating">Rating</Label>
                <select
                  id="rev-rating"
                  name="rating"
                  required
                  defaultValue=""
                  className="mt-1 h-10 w-full rounded-lg border border-slate-300 bg-white px-3 text-sm shadow-sm focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-500/20"
                >
                  <option value="" disabled>Select rating…</option>
                  {[5, 4, 3, 2, 1].map((n) => (
                    <option key={n} value={n}>
                      {"★".repeat(n)}{"☆".repeat(5 - n)} — {n}/5
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <Label htmlFor="rev-comment">Your review</Label>
                <Textarea id="rev-comment" name="comment" required minLength={4} maxLength={600} placeholder="Care quality, waiting time, staff behaviour…" className="mt-1" />
              </div>
              <Button type="submit" disabled={!user}>
                Publish Review
              </Button>
            </div>
          </form>
        </div>
      </TabsContent>
    </Tabs>
  );
}

export function BedCards({ beds, compact }: { beds: Bed[]; compact?: boolean }) {
  const list = beds.length
    ? beds
    : BED_CATEGORIES.slice(0, compact ? 3 : 7).map((c) => ({ category: c.key, total: 0, available: 0 }));
  return (
    <div className={`grid gap-4 ${compact ? "sm:grid-cols-1" : "sm:grid-cols-2 lg:grid-cols-3"}`}>
      {list.map((b) => {
        const meta = BED_CATEGORIES.find((c) => c.key === b.category);
        const status =
          b.available <= 0 ? "UNAVAILABLE" : b.available / Math.max(1, b.total) < 0.15 ? "LIMITED" : "AVAILABLE";
        const usedPct = Math.round(((b.total - b.available) / Math.max(1, b.total)) * 100);
        return (
          <div key={b.category} className="rounded-xl border border-slate-200 bg-white p-5 shadow-card">
            <div className="flex items-center justify-between">
              <p className="flex items-center gap-2 text-sm font-semibold text-primary-900">
                <BedDouble className="h-4 w-4 text-care-600" aria-hidden />
                {meta?.label ?? b.category}
              </p>
              <StatusBadge status={status} />
            </div>
            <p className="mt-3 text-2xl font-bold text-primary-900">
              {b.available}
              <span className="ml-1.5 text-sm font-medium text-slate-400">
                of {b.total} available
              </span>
            </p>
            <div className="mt-3 h-2 overflow-hidden rounded-full bg-slate-100" role="presentation">
              <div
                className={`h-full rounded-full transition-all ${
                  status === "AVAILABLE"
                    ? "bg-india-500"
                    : status === "LIMITED"
                      ? "bg-saffron-500"
                      : "bg-red-500"
                }`}
                style={{ width: `${usedPct}%` }}
              />
            </div>
            <p className="mt-2 text-[11px] text-slate-400">{usedPct}% occupied</p>
          </div>
        );
      })}
    </div>
  );
}

function Stars({ value }: { value: number }) {
  return (
    <span aria-label={`${value} out of 5 stars`} className="text-sm text-saffron-500">
      {"★".repeat(value)}
      <span className="text-slate-300">{"★".repeat(5 - value)}</span>
    </span>
  );
}
