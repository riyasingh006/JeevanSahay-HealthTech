"use client";

import * as React from "react";
import Link from "next/link";
import {
  Award,
  CalendarPlus,
  Car,
  MapPin,
  Navigation,
  Phone,
} from "lucide-react";
import { Badge, StatusBadge, LastUpdated } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { SaveHospitalButton } from "@/components/patient/save-hospital-button";
import { DemoDataBadge, DemoFacilityNotice, FacilityReportedNotice } from "@/components/ui/data-source";

export interface AiMatch {
  hospital: {
    id: string;
    name: string;
    type: string;
    city: string;
    isDemo?: boolean;
    addressLine?: string;
    phone: string;
    lat: number;
    lng: number;
    lastAvailabilityUpdate?: string | Date;
    beds: { category: string; total: number; available: number }[];
    services: { key: string; status: string }[];
    doctors: { specialty: string; availability: string }[];
  };
  score: number;
  distanceKm: number;
  etaMinutes: number;
  why: string[];
}

const RANK_LABELS = [
  "Best Match",
  "Strong Match",
  "Good Match",
  "Good Match",
] as const;

const FACILITY_ROWS: { label: string; keys: string[] }[] = [
  { label: "ICU", keys: ["ICU"] },
  { label: "General Ward", keys: ["GENERAL"] },
  { label: "Emergency", keys: ["EMERGENCY"] },
  { label: "Pharmacy", keys: ["PHARMACY"] },
  { label: "Laboratory", keys: ["DIAGNOSTICS"] },
  { label: "Imaging", keys: ["MRI", "CT_SCAN"] },
  { label: "Ambulance", keys: ["AMBULANCE"] },
];

function bed(m: AiMatch, cat: string) {
  return m.hospital.beds.find((b) => b.category === cat);
}

function svcStatus(m: AiMatch, keys: string[]): "AVAILABLE" | "LIMITED" | "UNAVAILABLE" | "MISSING" {
  const rows = m.hospital.services.filter((s) => keys.includes(s.key));
  if (rows.length === 0) return "MISSING";
  const statuses = rows.map((r) => r.status);
  if (statuses.includes("AVAILABLE")) return "AVAILABLE";
  if (statuses.includes("LIMITED")) return "LIMITED";
  return "UNAVAILABLE";
}

function FacilityDot({ state }: { state: ReturnType<typeof svcStatus> }) {
  if (state === "MISSING")
    return <span className="text-[11px] text-slate-400">Information Unavailable</span>;
  const color =
    state === "AVAILABLE"
      ? "bg-india-500"
      : state === "LIMITED"
        ? "bg-amber-500"
        : "bg-red-500";
  return (
    <span className="inline-flex items-center gap-1.5 text-[11px] font-medium capitalize text-slate-600">
      <span className={`inline-block h-2 w-2 rounded-full ${color}`} aria-hidden />
      {state.toLowerCase()}
    </span>
  );
}

export function AiRecommendationCard({
  match,
  index,
  saved,
  onToggleSave,
  onCompare,
  compareChecked,
  onDirections,
  onBook,
}: {
  match: AiMatch;
  index: number;
  saved?: boolean;
  onToggleSave?: () => void;
  onCompare?: (id: string) => void;
  compareChecked?: boolean;
  onDirections?: (m: AiMatch) => void;
  onBook?: (m: AiMatch) => void;
}) {
  const h = match.hospital;
  const isPrimary = index === 0;
  const isGov = h.type === "GOVERNMENT" || h.type === "PSU";
  const general = bed(match, "GENERAL");
  const icu = bed(match, "ICU");
  const emergencySvc = svcStatus(match, ["EMERGENCY"]);
  const doctorsAvailable = h.doctors.filter(
    (d) => d.availability !== "UNAVAILABLE"
  ).length;

  return (
    <article
      className={`relative overflow-hidden rounded-xl border bg-white shadow-card transition-shadow hover:shadow-raised ${
        isPrimary ? "border-saffron-400 ring-1 ring-saffron-300" : "border-slate-200"
      }`}
    >
      {/* Rank ribbon */}
      <div
        className={`flex items-center gap-3 border-b px-5 py-3 ${
          isPrimary ? "border-saffron-100 bg-saffron-50/60" : "border-slate-100 bg-paper"
        }`}
      >
        <span
          className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-sm font-bold tabular-nums ${
            isPrimary ? "bg-saffron-500 text-white" : "bg-primary-700 text-white"
          }`}
          aria-hidden
        >
          {String(index + 1).padStart(2, "0")}
        </span>
        <div className="min-w-0 flex-1">
          {isPrimary && (
            <p className="flex items-center gap-1 text-[11px] font-semibold uppercase tracking-wide text-saffron-700">
              <Award className="h-3.5 w-3.5" aria-hidden /> Best Match Based on Your Selected Preferences
            </p>
          )}
          <h3 className="truncate text-base font-semibold text-primary-950">
            <Link href={`/dashboard/hospitals/${h.id}`} className="hover:underline">
              {h.name}
            </Link>
          </h3>
          {h.isDemo && <DemoDataBadge />}
        </div>
        <Badge variant={isPrimary ? "saffron" : "primary"} size="sm">
          {RANK_LABELS[index] ?? "Good Match"}
        </Badge>
      </div>

      <div className="p-5 pt-4">
        {/* BASIC */}
        <p className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-slate-500">
          <Badge variant={isGov ? "saffron" : "primary"} size="sm">
            {isGov ? "Government" : h.type === "TRUST" ? "Trust / NGO" : "Private"}
          </Badge>
          <span className="inline-flex items-center gap-1">
            <MapPin className="h-3.5 w-3.5" aria-hidden />
            {h.addressLine ? `${h.addressLine}, ` : ""}
            {h.city}
          </span>
          <span className="inline-flex items-center gap-1 font-medium text-primary-800">
            <Car className="h-3.5 w-3.5" aria-hidden />
            {match.distanceKm > 0
              ? `${match.distanceKm.toFixed(1)} km · ~${match.etaMinutes} min`
              : `~${match.etaMinutes} min drive`}
          </span>
        </p>

        {/* WHY THIS HOSPITAL? */}
        {match.why.length > 0 && (
          <div className="mt-3 rounded-lg border border-care-100 bg-care-50/60 px-3.5 py-2.5">
            <p className="text-[11px] font-semibold uppercase tracking-wide text-care-800">
              Why this hospital?
            </p>
            <ul className="mt-1 space-y-0.5">
              {match.why.map((w) => (
                <li key={w} className="flex items-start gap-1.5 text-xs leading-relaxed text-slate-700">
                  <span className="mt-1.5 inline-block h-1 w-1 shrink-0 rounded-full bg-care-500" aria-hidden />
                  {w}
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* MATCH */}
        <dl className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-4">
          <div className="rounded-lg border border-slate-100 bg-paper px-3 py-2">
            <dt className="data-label">Doctors listed</dt>
            <dd className="mt-0.5 text-sm font-semibold tabular-nums text-primary-950">
              {doctorsAvailable > 0 ? `${doctorsAvailable}` : "Information Unavailable"}
            </dd>
          </div>
          <div className="rounded-lg border border-slate-100 bg-paper px-3 py-2">
            <dt className="data-label">General beds reported available</dt>
            <dd className="mt-0.5 text-sm font-semibold tabular-nums text-primary-950">
              {general ? `${general.available}` : "Information Unavailable"}
            </dd>
          </div>
          <div className="rounded-lg border border-slate-100 bg-paper px-3 py-2">
            <dt className="data-label">ICU beds reported available</dt>
            <dd className="mt-0.5 text-sm font-semibold tabular-nums text-primary-950">
              {icu ? `${icu.available}` : "Information Unavailable"}
            </dd>
          </div>
          <div className="rounded-lg border border-slate-100 bg-paper px-3 py-2">
            <dt className="data-label">Emergency</dt>
            <dd className="mt-0.5">
              {emergencySvc === "MISSING" ? (
                <span className="text-xs text-slate-400">Information Unavailable</span>
              ) : (
                <StatusBadge status={emergencySvc} label="Emergency status (reported)" />
              )}
            </dd>
          </div>
        </dl>

        {/* TRUST */}
        <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-slate-500">
          <span className="inline-flex items-center gap-1">
            Rating: <span className="font-medium text-slate-600">Not yet available</span>
          </span>
          <span aria-hidden>·</span>
          <span>Reviews: Information Unavailable</span>
          <span aria-hidden>·</span>
          {!h.isDemo && h.phone && <a href={`tel:${h.phone.replace(/\s/g, "")}`} className="inline-flex items-center gap-1 font-medium text-care-700 hover:underline">
            <Phone className="h-3 w-3" aria-hidden /> {h.phone}
          </a>}
          {h.lastAvailabilityUpdate && <LastUpdated at={h.lastAvailabilityUpdate} />}
        </div>

        {/* FACILITIES */}
        <details className="group mt-3 rounded-lg border border-slate-100 open:bg-paper/40">
          <summary className="cursor-pointer list-none px-3.5 py-2 text-[11px] font-semibold uppercase tracking-wide text-slate-500 hover:text-primary-800">
            Facilities &amp; services
          </summary>
          <div className="grid grid-cols-2 gap-x-6 gap-y-1.5 border-t border-slate-100 px-3.5 py-3 sm:grid-cols-3">
            {FACILITY_ROWS.map((f) => (
              <div key={f.label}>
                <p className="text-xs font-medium text-slate-700">{f.label}</p>
                <FacilityDot state={svcStatus(match, f.keys)} />
              </div>
            ))}
            {["Food / Cafeteria", "Restroom", "Parking", "Accessibility"].map((label) => (
              <div key={label}>
                <p className="text-xs font-medium text-slate-700">{label}</p>
                <span className="text-[11px] text-slate-400">Information Unavailable</span>
              </div>
            ))}
          </div>
        </details>

        <div className="mt-2 space-y-1.5">
          {h.isDemo && <DemoFacilityNotice />}
          <FacilityReportedNotice />
          <p className="text-[11px] leading-snug text-slate-500">
            Appointment requests are sent to the facility and are not confirmed until it responds.
          </p>
        </div>

        {/* ACTIONS — reuse existing flows */}
        <div className="mt-3 flex flex-wrap items-center gap-2 border-t border-slate-100 pt-3.5">
          <Link href={`/dashboard/hospitals/${h.id}`}>
            <Button variant="primary" size="sm">View Details</Button>
          </Link>
          <label className="inline-flex cursor-pointer items-center gap-2 text-sm text-slate-600">
            <input
              type="checkbox"
              checked={compareChecked ?? false}
              onChange={() => onCompare?.(h.id)}
              className="h-4 w-4 accent-care-600"
              aria-label={`Select ${h.name} for comparison`}
            />
            Compare
          </label>
          {!h.isDemo && <SaveHospitalButton hospitalId={h.id} saved={saved ?? false} onChange={() => onToggleSave?.()} />}
          {!h.isDemo && <Button variant="ghost" size="sm" onClick={() => onDirections?.(match)}>
            <Navigation className="h-4 w-4" aria-hidden /> Get Directions
          </Button>}
          <Link href="/dashboard/doctors">
            <Button variant="secondary" size="sm">View Doctors</Button>
          </Link>
          {!h.isDemo && <Button variant="subtle" size="sm" onClick={() => onBook?.(match)}>
            <CalendarPlus className="h-4 w-4" aria-hidden /> Book Appointment
          </Button>}
        </div>
      </div>
    </article>
  );
}
