"use client";

import * as React from "react";
import Link from "next/link";
import {
  Building2,
  CalendarPlus,
  Car,
  ExternalLink,
  MapPin,
  Navigation,
  Phone,
} from "lucide-react";
import { Badge, StatusBadge, LastUpdated } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { SaveHospitalButton } from "@/components/patient/save-hospital-button";
import { DemoDataBadge, DemoFacilityNotice, FacilityReportedNotice } from "@/components/ui/data-source";

export type SearchResultItem = {
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
    doctors: { specialty: string; availability: string; experienceYears?: number }[];
  };
  score?: number;
  distanceKm: number;
  etaMinutes: number;
  reasons?: string[];
  /** "google" = live Google Places listing (no local availability data). */
  source?: "google" | "local";
  /** Human-readable facility category, e.g. "General hospital". */
  typeLabel?: string;
  rating?: number;
  userRatingCount?: number;
  primaryType?: string;
  openingStatus?: string;
  website?: string;
  googleMapsUri?: string;
  businessStatus?: string;
};

function bed(h: SearchResultItem["hospital"], cat: string) {
  return h.beds.find((b) => b.category === cat);
}

function serviceStatus(h: SearchResultItem["hospital"], key: string) {
  return h.services.find((s) => s.key === key)?.status ?? "UNKNOWN";
}

function businessStatusLabel(status?: string, opening?: string) {
  if (opening) return opening;
  switch (status) {
    case "OPERATIONAL":
      return "Operational";
    case "CLOSED_TEMPORARILY":
      return "Temporarily closed";
    case "CLOSED_PERMANENTLY":
      return "Permanently closed";
    default:
      return "Not available";
  }
}

export function PortalHospitalCard({
  item,
  saved,
  onToggleSave,
  onCompare,
  compareChecked,
  onDirections,
  onBook,
}: {
  item: SearchResultItem;
  saved?: boolean;
  onToggleSave?: (id: string, next: boolean) => void;
  onCompare?: (id: string) => void;
  compareChecked?: boolean;
  onDirections?: (item: SearchResultItem) => void;
  onBook?: (item: SearchResultItem) => void;
}) {
  const h = item.hospital;
  const isExternal = item.source === "google";
  const general = bed(h, "GENERAL");
  const icu = bed(h, "ICU");
  const emergencySvc = serviceStatus(h, "EMERGENCY");
  const emergencyBed = bed(h, "EMERGENCY");
  const doctorsAvailable = h.doctors.filter(
    (d) => d.availability !== "UNAVAILABLE"
  ).length;
  const specialties = Array.from(new Set(h.doctors.map((d) => d.specialty)));
  const isGov = h.type === "GOVERNMENT" || h.type === "PSU";
  const typeBadgeLabel =
    item.typeLabel?.trim() ||
    (isGov ? "Government" : h.type === "TRUST" ? "Trust / NGO" : "Private");
  const hasPhone = h.phone.trim().length > 0;

  return (
    <article className="rounded-xl border border-slate-200 bg-white p-5 shadow-card transition-shadow hover:shadow-raised">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0">
          <h3 className="truncate text-base font-semibold text-primary-950">
            <Link href={`/dashboard/hospitals/${h.id}`} className="hover:underline">
              {h.name}
            </Link>
          </h3>
          {h.isDemo ? <div className="mt-1"><DemoDataBadge /></div> : !isExternal && <p className="mt-1 text-xs font-medium text-slate-500">Facility-entered information</p>}
          <p className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-slate-500">
            <span className="inline-flex items-center gap-1">
              <MapPin className="h-3.5 w-3.5" aria-hidden />
              {h.city || h.addressLine || "Address unavailable"}
            </span>
            <span className="inline-flex items-center gap-1 font-medium text-primary-800">
              <Car className="h-3.5 w-3.5" aria-hidden />
              {item.distanceKm > 0
                ? `${item.distanceKm.toFixed(1)} km · ~${item.etaMinutes} min`
                : `~${item.etaMinutes} min drive`}
            </span>
          </p>
        </div>
        <div className="flex shrink-0 items-center gap-1.5">
          <Badge variant={isGov ? "saffron" : "primary"} size="sm">
            <Building2 className="h-3 w-3" aria-hidden /> {typeBadgeLabel}
          </Badge>
          {typeof item.score === "number" && (
            <Badge variant="green" size="sm">{item.score}% match</Badge>
          )}
        </div>
      </div>

      {!isExternal && <div className="mt-3">{h.isDemo ? <DemoFacilityNotice /> : <FacilityReportedNotice />}</div>}

      {item.reasons && item.reasons.length > 0 && (
        <ul className="mt-2 flex flex-wrap gap-1.5" aria-label="Why this facility matches">
          {item.reasons.slice(0, 3).map((r) => (
            <li key={r}>
              <Badge variant="neutral" size="sm">{r}</Badge>
            </li>
          ))}
        </ul>
      )}

      {isExternal ? (
        <dl className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-4">
          <div className="rounded-lg border border-slate-100 bg-paper px-3 py-2">
            <dt className="data-label">Rating</dt>
            <dd className="mt-0.5 text-sm font-semibold tabular-nums text-primary-950">
              {typeof item.rating === "number"
                ? `${item.rating.toFixed(1)} ★`
                : "Not available"}
              {typeof item.userRatingCount === "number" && (
                <span className="ml-1 text-[11px] font-normal text-slate-400">
                  ({item.userRatingCount})
                </span>
              )}
            </dd>
          </div>
          <div className="rounded-lg border border-slate-100 bg-paper px-3 py-2">
            <dt className="data-label">Status</dt>
            <dd className="mt-0.5 text-sm font-semibold text-primary-950">
              {businessStatusLabel(item.businessStatus, item.openingStatus)}
            </dd>
          </div>
          <div className="rounded-lg border border-slate-100 bg-paper px-3 py-2">
            <dt className="data-label">Phone</dt>
            <dd className="mt-0.5 text-sm font-semibold text-primary-950">
              {hasPhone ? (
                <a
                  href={`tel:${h.phone.replace(/\s/g, "")}`}
                  className="font-medium text-care-700 hover:underline"
                >
                  {h.phone}
                </a>
              ) : (
                "Not available"
              )}
            </dd>
          </div>
          <div className="rounded-lg border border-slate-100 bg-paper px-3 py-2">
            <dt className="data-label">Website</dt>
            <dd className="mt-0.5 text-sm font-semibold text-primary-950">
              {item.website ? (
                <a
                  href={item.website}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 font-medium text-care-700 hover:underline"
                >
                  Visit <ExternalLink className="h-3 w-3" aria-hidden />
                </a>
              ) : (
                "Not available"
              )}
            </dd>
          </div>
        </dl>
      ) : (
        <dl className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-4">
          <div className="rounded-lg border border-slate-100 bg-paper px-3 py-2">
            <dt className="data-label">General beds</dt>
            <dd className="mt-0.5 text-sm font-semibold tabular-nums text-primary-950">
              {general ? `${general.available} reported` : "Unavailable"}
              {general && (
                <span className="ml-1 text-[11px] font-normal text-slate-400">
                  of {general.total}
                </span>
              )}
            </dd>
          </div>
          <div className="rounded-lg border border-slate-100 bg-paper px-3 py-2">
            <dt className="data-label">ICU</dt>
            <dd className="mt-0.5 text-sm font-semibold tabular-nums text-primary-950">
              {icu ? `${icu.available} reported` : "Unavailable"}
            </dd>
          </div>
          <div className="flex items-center rounded-lg border border-slate-100 bg-paper px-3 py-2">
            <dt className="sr-only">Emergency department</dt>
            <dd>
              <StatusBadge
                status={
                  emergencySvc !== "UNAVAILABLE" && (emergencyBed?.available ?? 0) > 0
                    ? "AVAILABLE"
                    : emergencySvc !== "UNAVAILABLE"
                      ? "LIMITED"
                      : "UNAVAILABLE"
                }
                label="Emergency status (reported)"
              />
            </dd>
          </div>
          <div className="rounded-lg border border-slate-100 bg-paper px-3 py-2">
            <dt className="data-label">Doctors</dt>
            <dd className="mt-0.5 text-sm font-semibold tabular-nums text-primary-950">
              {doctorsAvailable > 0
                ? `${doctorsAvailable} listed`
                : "Information unavailable"}
            </dd>
          </div>
        </dl>
      )}

      <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-2 text-xs text-slate-500">
        {isExternal ? (
          <>
            {item.primaryType && <span>{item.primaryType}</span>}
            {item.primaryType && item.googleMapsUri && <span aria-hidden>·</span>}
            {item.googleMapsUri && (
              <a
                href={item.googleMapsUri}
                target="_blank"
                rel="noopener noreferrer"
                className="font-medium text-care-700 hover:underline"
              >
                <ExternalLink className="mr-0.5 inline h-3 w-3" aria-hidden /> View on
                Google Maps
              </a>
            )}
          </>
        ) : (
          <>
            <span>
              {specialties.length} specialit{specialties.length === 1 ? "y" : "ies"}
            </span>
            <span aria-hidden>·</span>
            {!h.isDemo && hasPhone && (
              <a href={`tel:${h.phone.replace(/\s/g, "")}`} className="font-medium text-care-700 hover:underline">
                <Phone className="mr-0.5 inline h-3 w-3" aria-hidden /> {h.phone}
              </a>
            )}
            {h.lastAvailabilityUpdate && (
              <LastUpdated at={h.lastAvailabilityUpdate} />
            )}
          </>
        )}
      </div>

      <div className="mt-4 flex flex-wrap items-center gap-2 border-t border-slate-100 pt-3.5">
        <label className="mr-auto inline-flex cursor-pointer items-center gap-2 text-sm text-slate-600">
          <input
            type="checkbox"
            checked={compareChecked ?? false}
            onChange={() => onCompare?.(h.id)}
            className="h-4 w-4 accent-care-600"
            aria-label={`Select ${h.name} for comparison`}
          />
          Compare
        </label>
        {!h.isDemo && <SaveHospitalButton
          hospitalId={h.id}
          saved={saved ?? false}
          onChange={(next) => onToggleSave?.(h.id, next)}
        />}
        {!h.isDemo && <Button
          variant="ghost"
          size="sm"
          onClick={() => onDirections?.(item)}
        >
          <Navigation className="h-4 w-4" aria-hidden /> Directions
        </Button>}
        {!h.isDemo && <Button variant="subtle" size="sm" onClick={() => onBook?.(item)}>
          <CalendarPlus className="h-4 w-4" aria-hidden /> Book Appointment
        </Button>}
        <Link href={`/dashboard/hospitals/${h.id}`}>
          <Button variant="primary" size="sm">View Details</Button>
        </Link>
      </div>
    </article>
  );
}
