"use client";

import * as React from "react";
import {
  Ambulance,
  BedDouble,
  BrainCircuit,
  Car,
  CheckCircle2,
  FlaskConical,
  MapPin,
  Stethoscope,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { SectionHeading } from "@/components/layout/page-header";
import { Skeleton } from "@/components/ui/skeleton";
import { formatDistance } from "@/lib/utils";

interface ApiHospital {
  id: string;
  name: string;
  beds: { category: string; available: number }[];
}

// Structural type matching the /api/hospitals/search payload actually used here.
type TopPick = {
  score: number;
  distanceKm: number;
  etaMinutes: number;
  reasons: string[];
  hospital: ApiHospital;
};

export function RecommendationPreview() {
  const [pick, setPick] = React.useState<TopPick | null>(null);
  const [loading, setLoading] = React.useState(true);

  React.useEffect(() => {
    let alive = true;
    fetch("/api/hospitals/search?icu=1&emergency=1&limit=1", { cache: "no-store" })
      .then((r) => r.json())
      .then((json) => {
        if (alive && json.ok && json.data.results?.length) {
          const first = json.data.results[0];
          setPick(first);
        }
      })
      .catch(() => {})
      .finally(() => alive && setLoading(false));
    return () => {
      alive = false;
    };
  }, []);

  return (
    <section className="bg-paper py-14">
      <div className="container grid items-center gap-10 lg:grid-cols-[0.9fr_1.1fr]">
        <SectionHeading
          eyebrow="Intelligent Ranking"
          title="See what a जीवन Sahay recommendation looks like"
          description="Every recommendation is transparent — you always see why a hospital was suggested, its current availability and how long it takes to reach."
        />

        {/* ---- Recommendation card ---- */}
        <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-raised">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <p className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-care-600">
                <BrainCircuit className="h-4 w-4" aria-hidden />
                AI Recommended
              </p>
              {loading ? (
                <>
                  <Skeleton className="mt-2 h-7 w-64" />
                  <Skeleton className="mt-2 h-4 w-40" />
                </>
              ) : (
                <>
                  <h3 className="mt-1.5 text-xl font-bold text-primary-900">
                    {pick?.hospital.name ?? "City Multispeciality Hospital"}
                  </h3>
                  <p className="mt-1 text-sm font-semibold text-india-600">
                    {pick?.score ?? 94}% Suitability Match
                  </p>
                </>
              )}
              <div className="mt-3 flex flex-wrap items-center gap-4 text-sm text-slate-600">
                <span className="flex items-center gap-1.5">
                  <MapPin className="h-4 w-4 text-slate-400" aria-hidden />
                  {pick ? formatDistance(pick.distanceKm) : "4.2 km"}
                </span>
                <span className="flex items-center gap-1.5">
                  <Car className="h-4 w-4 text-slate-400" aria-hidden />
                  {pick ? `${pick.etaMinutes} min ETA` : "10 min ETA"}
                </span>
              </div>
            </div>

            <div className="grid w-full grid-cols-2 gap-2 sm:w-auto sm:grid-cols-1">
              <Fact icon={<BedDouble className="h-3.5 w-3.5" />} tone="green">
                ICU — {pick?.hospital.beds.find((b) => b.category === "ICU")?.available ?? 4} Available
              </Fact>
              <Fact icon={<Stethoscope className="h-3.5 w-3.5" />} tone="blue">
                Cardiology — Available
              </Fact>
              <Fact icon={<Ambulance className="h-3.5 w-3.5" />} tone="red">
                Emergency — Active
              </Fact>
              <Fact icon={<FlaskConical className="h-3.5 w-3.5" />} tone="blue">
                Diagnostics — Available
              </Fact>
            </div>
          </div>

          <div className="mt-5 rounded-lg bg-paper p-4">
            <p className="text-xs font-bold uppercase tracking-wider text-slate-500">
              Why this hospital?
            </p>
            <ul className="mt-2 grid gap-x-6 gap-y-1.5 sm:grid-cols-2">
              {(pick?.reasons ?? [
                "Required specialty available",
                "ICU availability",
                "Emergency services active",
                "Suitable diagnostics",
                "Short travel time",
              ]).map((r) => (
                <li key={r} className="flex items-start gap-2 text-sm text-slate-700">
                  <CheckCircle2
                    className="mt-0.5 h-4 w-4 shrink-0 text-india-600"
                    aria-hidden
                  />
                  {r}
                </li>
              ))}
            </ul>
          </div>

          <div className="mt-5">
            <Button size="lg" onClick={() => (window.location.href = pick ? `/hospitals/${pick.hospital.id}` : "/hospitals")}>
              View Recommendation
            </Button>
          </div>
        </div>
      </div>
    </section>
  );
}

function Fact({
  icon,
  children,
  tone,
}: {
  icon: React.ReactNode;
  children: React.ReactNode;
  tone: "green" | "blue" | "red";
}) {
  const tones = {
    green:
      "border-status-available-border bg-status-available-bg text-status-available-fg",
    blue: "border-status-info-border bg-status-info-bg text-status-info-fg",
    red: "border-red-200 bg-red-50 text-red-700",
  };
  return (
    <span
      className={`inline-flex items-center gap-1.5 whitespace-nowrap rounded-full border px-2.5 py-1 text-[11px] font-semibold ${tones[tone]}`}
    >
      {icon}
      {children}
    </span>
  );
}
