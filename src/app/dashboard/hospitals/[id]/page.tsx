"use client";

import * as React from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import {
  AlertTriangle,
  Building2,
  CalendarPlus,
  Car,
  ExternalLink,
  GitCompareArrows,
  MapPin,
  Phone,
  PhoneCall,
  Siren,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { DemoDataBadge, DemoFacilityNotice, FacilityReportedNotice } from "@/components/ui/data-source";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState } from "@/components/ui/empty-state";
import { HospitalDetailTabs } from "@/components/hospital/hospital-detail-tabs";
import { SaveHospitalButton, useSavedHospitals } from "@/components/patient/save-hospital-button";
import { DirectionsDialog } from "@/components/patient/directions-dialog";
import { AppointmentDialog, type BookingDoctor } from "@/components/patient/appointment-dialog";
import {
  loadPatientLocation,
} from "@/lib/patient/location";
import { DEFAULT_CENTER, FRESHNESS_MS } from "@/lib/constants";
import { estimateEtaMinutes, formatDistance, haversineKm } from "@/lib/utils";

interface DetailResponse {
  ok: boolean;
  data?: {
    hospital: {
      id: string;
      name: string;
      shortName: string | null;
      type: string;
      status: string;
      addressLine: string;
      isDemo: boolean;
      city: string;
      state: string;
      pincode: string;
      phone: string;
      emergencyPhone: string | null;
      email: string | null;
      website: string | null;
      about: string | null;
      accreditation: string | null;
      established: number | null;
      lastAvailabilityUpdate: string;
      lat: number;
      lng: number;
      beds: { category: string; total: number; available: number }[];
      services: { key: string; status: string }[];
      source?: string;
      rating?: number;
      userRatingCount?: number;
      googleMapsUri?: string;
      primaryType?: string;
      openNow?: boolean;
      businessStatus?: string;
    };
    doctors: {
      id: string;
      name: string;
      specialty: string;
      department: string | null;
      qualification: string | null;
      experienceYears: number;
      availability: string;
      timings: string | null;
      languages: string | null;
    }[];
  };
  error?: string;
}

interface ReviewItem {
  id: string;
  name: string;
  rating: number;
  comment: string;
  createdAt: string;
}

export default function PortalHospitalDetailPage() {
  const routeParams = useParams<{ id: string }>();
  const id = routeParams?.id;
  const [data, setData] = React.useState<DetailResponse["data"] | null>(null);
  const [reviews, setReviews] = React.useState<ReviewItem[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [failed, setFailed] = React.useState(false);
  const [origin, setOrigin] = React.useState<{ lat: number; lng: number; label: string } | null>(null);
  const [directionsOpen, setDirectionsOpen] = React.useState(false);
  const [bookingDoctor, setBookingDoctor] = React.useState<BookingDoctor | null>(null);
  const { savedIds, refresh: refreshSaved } = useSavedHospitals();

  React.useEffect(() => {
    const loc = loadPatientLocation();
    if (loc)
      setOrigin({ lat: loc.lat, lng: loc.lng, label: loc.label });
  }, []);

  React.useEffect(() => {
    if (!id) return;
    let alive = true;
    setLoading(true);
    setFailed(false);
    Promise.all([
      fetch(`/api/hospitals/${id}`, { cache: "no-store" }).then((r) => r.json()),
      fetch(`/api/hospitals/${id}/reviews`, { cache: "no-store" })
        .then((r) => r.json())
        .catch(() => ({ ok: false })),
    ])
      .then(([detail, revs]) => {
        if (!alive) return;
        if (detail.ok) {
          setData(detail.data);
          setReviews(revs?.ok ? revs.data.reviews ?? [] : []);
        } else {
          setFailed(true);
        }
      })
      .catch(() => alive && setFailed(true))
      .finally(() => alive && setLoading(false));
    return () => {
      alive = false;
    };
  }, [id]);

  if (loading) {
    return (
      <div className="mx-auto max-w-6xl space-y-4">
        <Skeleton className="h-8 w-80" />
        <Skeleton className="h-24 w-full" />
        <Skeleton className="h-96 w-full" />
      </div>
    );
  }

  if (failed || !data) {
    return (
      <div className="mx-auto max-w-2xl">
        <EmptyState
          icon={<AlertTriangle className="h-6 w-6" />}
          title="Hospital not found"
          description="This facility may no longer be listed. Please search again."
          action={
            <Link href="/dashboard/hospitals">
              <Button variant="primary">Back to Find Hospitals</Button>
            </Link>
          }
        />
      </div>
    );
  }

  const h = data.hospital;
  const isExternal = h.status === "EXTERNAL" || h.source === "google";
  const refPoint = origin ?? DEFAULT_CENTER;
  const distanceKm = haversineKm(refPoint, { lat: h.lat, lng: h.lng });
  const etaMinutes = estimateEtaMinutes(distanceKm);
  const stale =
    Date.now() - new Date(h.lastAvailabilityUpdate).getTime() > FRESHNESS_MS;

  const primaryDoctor = data.doctors[0];
  const booking: BookingDoctor | null = primaryDoctor
    ? {
        id: primaryDoctor.id,
        name: primaryDoctor.name,
        specialty: primaryDoctor.specialty,
        qualification: primaryDoctor.qualification,
        hospitalId: h.id,
        hospitalName: h.name,
        hospitalPhone: h.phone,
        hospitalCity: h.city,
        timings: primaryDoctor.timings,
      }
    : {
        id: `generic-${h.id}`,
        name: "General Physician",
        specialtyLabel: "General consultation",
        hospitalId: h.id,
        hospitalName: h.name,
        hospitalPhone: h.phone,
        hospitalCity: h.city,
        timings: null,
      };

  return (
    <div className="mx-auto max-w-6xl">
      {/* ---------- Breadcrumb ---------- */}
      <nav aria-label="Breadcrumb" className="text-xs text-slate-500">
        <Link href="/dashboard" className="hover:underline">Dashboard</Link>
        <span aria-hidden> / </span>
        <Link href="/dashboard/hospitals" className="hover:underline">Find Hospitals</Link>
        <span aria-hidden> / </span>
        <span className="font-medium text-primary-800">{h.name}</span>
      </nav>

      {/* ---------- Header ---------- */}
      <header className="mt-3 flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="institutional-heading text-xl md:text-2xl">{h.name}</h1>
            {h.isDemo ? <DemoDataBadge /> : h.status === "VERIFIED" && <Badge variant="green" size="md">✓ Verified</Badge>}
            {isExternal ? (
              <Badge variant="neutral" size="md">
                {h.primaryType ?? "Listed on Google"}
              </Badge>
            ) : (
              <Badge variant="primary" size="md">
                <Building2 className="h-3 w-3" aria-hidden />{" "}
                {h.type === "GOVERNMENT" || h.type === "PSU" ? "Government" : h.type === "TRUST" ? "Trust / NGO" : "Private"}
              </Badge>
            )}
            {!isExternal && h.accreditation && <Badge variant="neutral" size="md">{h.accreditation}</Badge>}
          </div>
          <dl className="mt-2 grid gap-x-8 gap-y-1.5 text-sm text-slate-600 sm:grid-cols-2 lg:grid-cols-4">
            <div className="flex items-center gap-1.5">
              <MapPin className="h-4 w-4 shrink-0 text-slate-400" aria-hidden />
              <dd>{isExternal ? h.addressLine : `${h.addressLine}, ${h.city} — ${h.pincode}`}</dd>
            </div>
            <div className="flex items-center gap-1.5">
              <Phone className="h-4 w-4 shrink-0 text-slate-400" aria-hidden />
              <dd>{h.isDemo ? "Not provided in sample data" : h.phone || "Phone not available"}</dd>
            </div>
            {!h.isDemo && h.emergencyPhone && (
              <div className="flex items-center gap-1.5 font-medium text-red-700">
                <Siren className="h-4 w-4 shrink-0" aria-hidden />
                <dd>
                  <a href={`tel:${h.emergencyPhone.replace(/\s/g, "")}`} className="hover:underline">
                    {h.emergencyPhone}
                  </a>
                </dd>
              </div>
            )}
            <div className="flex items-center gap-1.5">
              <Car className="h-4 w-4 shrink-0 text-slate-400" aria-hidden />
              <dd>
                {formatDistance(distanceKm)} · ~{etaMinutes} min drive
                {origin ? "" : " (from default centre)"}
              </dd>
            </div>
          </dl>
        </div>

        {/* ---------- Actions ---------- */}
        <div className="flex flex-wrap items-center gap-2">
          {!h.isDemo && <SaveHospitalButton
            hospitalId={h.id}
            saved={savedIds.has(h.id)}
            onChange={() => void refreshSaved()}
            size="md"
          />}
          <Link href={`/dashboard/compare?ids=${h.id}`}>
            <Button variant="ghost" size="sm" className="gap-1.5">
              <GitCompareArrows className="h-4 w-4" aria-hidden /> Compare
            </Button>
          </Link>
          {!h.isDemo && <Button variant="subtle" size="sm" className="gap-1.5" onClick={() => setDirectionsOpen(true)}>
            <MapPin className="h-4 w-4" aria-hidden /> Get Directions
          </Button>}
          {isExternal && h.googleMapsUri && (
            <a href={h.googleMapsUri} target="_blank" rel="noopener noreferrer">
              <Button variant="ghost" size="sm" className="gap-1.5">
                <ExternalLink className="h-4 w-4" aria-hidden /> Google Maps
              </Button>
            </a>
          )}
          {!h.isDemo && h.phone && (
            <a href={`tel:${h.phone.replace(/\s/g, "")}`}>
              <Button variant="secondary" size="sm" className="gap-1.5">
                <PhoneCall className="h-4 w-4" aria-hidden /> Call
              </Button>
            </a>
          )}
          {!h.isDemo && <Button variant="primary" size="sm" className="gap-1.5" onClick={() => setBookingDoctor(booking)}>
            <CalendarPlus className="h-4 w-4" aria-hidden /> Book Appointment
          </Button>}
        </div>
      </header>

      {h.isDemo ? (
        <div className="mt-4"><DemoFacilityNotice /></div>
      ) : stale ? (
        <p role="alert" className="mt-4 rounded-lg border border-status-unavailable-border bg-status-unavailable-bg px-4 py-2.5 text-sm font-medium text-red-800">
          Availability information may be outdated — last update{" "}
          {new Date(h.lastAvailabilityUpdate).toLocaleString("en-IN")}. Please confirm directly with the facility.
        </p>
      ) : !isExternal ? (
        <div className="mt-4"><FacilityReportedNotice /></div>
      ) : null}

      {/* ---------- Details tabs (shared component, props-driven) ---------- */}
      <div className="mt-5">
        <HospitalDetailTabs
          hospital={h}
          distanceKm={Math.round(distanceKm * 10) / 10}
          etaMinutes={etaMinutes}
          stale={stale}
          doctors={data.doctors.map((d) => ({
            id: d.id,
            name: d.name,
            specialty: d.specialty,
            department: d.department,
            qualification: d.qualification,
            experienceYears: d.experienceYears,
            availability: d.availability,
            timings: d.timings,
            languages: d.languages,
          }))}
          reviews={reviews}
        />
      </div>

      <p className="mt-8 border-t border-slate-100 pt-4 text-xs leading-relaxed text-slate-500">
        {isExternal
          ? "This listing is provided by Google Places. Google business status is not a statement about beds, staffing or emergency capacity. Confirm facility details directly. This page provides navigation support only and is not medical advice."
          : h.isDemo
            ? "Synthetic demonstration record only. It does not describe a real facility or its location, staffing, services or capacity. Do not use it for care decisions."
            : "Hospital-entered information may be outdated and is not a live operational feed. Confirm availability and services directly with the facility. This page provides navigation support only and is not medical advice."}
      </p>

      <DirectionsDialog
        open={directionsOpen}
        onOpenChange={setDirectionsOpen}
        destination={{ id: h.id, name: h.name, lat: h.lat, lng: h.lng, city: h.city }}
      />
      <AppointmentDialog
        open={bookingDoctor !== null}
        onOpenChange={(v) => !v && setBookingDoctor(null)}
        doctor={bookingDoctor}
      />
    </div>
  );
}
