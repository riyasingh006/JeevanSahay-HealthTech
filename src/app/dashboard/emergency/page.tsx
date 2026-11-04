"use client";

import * as React from "react";
import Link from "next/link";
import {
  AlertTriangle,
  Ambulance,
  Car,
  Loader2,
  LocateFixed,
  MapPin,
  Phone,
  Siren,
} from "lucide-react";
import { Badge, StatusBadge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState } from "@/components/ui/empty-state";
import { FacilityReportedNotice } from "@/components/ui/data-source";
import { AMBULANCE_HELPLINE, EMERGENCY_HELPLINE } from "@/lib/constants";
import { getCurrentPosition, loadPatientLocation, savePatientLocation, type GeoErrorKind } from "@/lib/patient/location";
import type { SearchResultItem } from "@/components/patient/hospital-result-card";

const GEO_HINTS: Record<GeoErrorKind, string> = {
  denied: "Location access was not allowed. Enter an address to search hospitals.",
  unavailable: "Your location could not be determined.",
  timeout: "Locating you took too long. Please retry.",
  unsupported: "Geolocation is not supported by this browser.",
  unknown: "Could not determine your location.",
};

type EmergencyOption = SearchResultItem & {
  hospital: SearchResultItem["hospital"] & { emergencyPhone: string | null };
};

export default function EmergencyPage() {
  const [condition, setCondition] = React.useState("");
  const [origin, setOrigin] = React.useState<{ lat: number; lng: number; label: string } | null>(null);
  const [geoBusy, setGeoBusy] = React.useState(false);
  const [options, setOptions] = React.useState<EmergencyOption[] | null>(null);
  const [failed, setFailed] = React.useState(false);

  const locate = React.useCallback(async () => {
    setGeoBusy(true);
    try {
      const pos = await getCurrentPosition();
      const label = "My current location";
      setOrigin({ ...pos, label });
      savePatientLocation({
        lat: pos.lat,
        lng: pos.lng,
        label,
        source: "device",
        savedAt: new Date().toISOString(),
      });
    } catch (e) {
      const kind = (e as { kind?: GeoErrorKind })?.kind ?? "unknown";
      const savedLoc = loadPatientLocation();
      if (savedLoc) setOrigin({ lat: savedLoc.lat, lng: savedLoc.lng, label: savedLoc.label });
      else if (kind !== "denied")
        console.warn(GEO_HINTS[kind]);
    } finally {
      setGeoBusy(false);
    }
  }, []);

  // Request location once on open — emergency mode must be fast.
  React.useEffect(() => {
    void locate();
  }, [locate]);

  React.useEffect(() => {
    let alive = true;
    setFailed(false);
    setOptions(null);
    fetch("/api/emergency/options", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        condition: condition.trim() || "medical emergency",
        ...(origin ? { lat: origin.lat, lng: origin.lng } : {}),
      }),
    })
      .then((r) => r.json())
      .then((json) => {
        if (!alive) return;
        if (json.ok) setOptions(json.data.options ?? []);
        else setFailed(true);
      })
      .catch(() => alive && setFailed(true));
    return () => {
      alive = false;
    };
  }, [condition, origin]);

  return (
    <div className="mx-auto max-w-6xl">
      <header className="flex flex-wrap items-center gap-3">
        <span className="flex h-12 w-12 items-center justify-center rounded-xl bg-red-50 text-[#B42318]" aria-hidden>
          <Siren className="h-6 w-6" />
        </span>
        <div>
          <h1 className="text-2xl font-bold text-[#B42318]">Emergency Mode</h1>
          <p className="text-sm text-slate-600">
            Nearby hospital listings with facility-reported emergency services and bed counts. Call to confirm.
          </p>
        </div>
      </header>

      <div className="mt-4"><FacilityReportedNotice /></div>

      {/* Helplines */}
      <div className="mt-4 grid gap-3 sm:grid-cols-3">
        <a href={`tel:${EMERGENCY_HELPLINE}`}>
          <Button variant="emergency" size="lg" className="w-full gap-2 py-4 text-base">
            <Phone className="h-5 w-5" aria-hidden /> Call 112 — Emergency
          </Button>
        </a>
        <a href={`tel:${AMBULANCE_HELPLINE}`}>
          <Button variant="emergency" size="lg" className="w-full gap-2 py-4 text-base">
            <Ambulance className="h-5 w-5" aria-hidden /> Call 108 — Ambulance
          </Button>
        </a>
        <Button
          variant="secondary"
          size="lg"
          className="w-full gap-2 py-4 text-base"
          onClick={() => void locate()}
          disabled={geoBusy}
        >
          {geoBusy ? (
            <Loader2 className="h-5 w-5 animate-spin" aria-hidden />
          ) : (
            <LocateFixed className="h-5 w-5" aria-hidden />
          )}
          {origin?.label === "My current location" ? "Location set" : "Use My Current Location"}
        </Button>
      </div>

      {/* Condition input */}
      <form
        className="mt-4"
        onSubmit={(e) => e.preventDefault()}
      >
        <label htmlFor="em-cond" className="sr-only">Describe the emergency</label>
        <Input
          id="em-cond"
          value={condition}
          onChange={(e) => setCondition(e.target.value)}
          placeholder="Optional: describe the emergency (e.g. chest pain, accident)"
          maxLength={200}
        />
      </form>

      {/* Results */}
      <p role="status" className="mt-4 text-xs text-slate-500">
        {origin ? (
          <>Ranking from <strong>{origin.label}</strong></>
        ) : geoBusy ? (
          "Determining your location…"
        ) : (
          "Using default centre (New Delhi). Tap “Use My Current Location” for precise results."
        )}
      </p>

      <div className="mt-3 space-y-3">
        {failed && (
          <EmptyState
            icon={<AlertTriangle className="h-6 w-6" />}
            title="Could not load emergency options."
            description="Please call 112 immediately and try again in a moment."
            action={<Link href="/dashboard/emergency"><Button variant="emergency">Reload</Button></Link>}
          />
        )}

        {!failed && options === null &&
          [0, 1, 2].map((i) => <Skeleton key={i} className="h-28 rounded-xl" />)}

        {!failed && options?.length === 0 && (
          <EmptyState
            icon={<Siren className="h-6 w-6" />}
            title={origin ? "No matching facility listing found nearby." : "No matching facility listing found."}
            description="Call 112 immediately for assistance."
          />
        )}

        {options?.map((opt, idx) => (
          <Card key={opt.hospital.id} className={idx === 0 ? "border-l-4 border-l-[#B42318]" : undefined}>
            <CardContent className="flex flex-wrap items-start justify-between gap-4 p-4">
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  {idx === 0 && <Badge variant="red" size="sm">Top directory match</Badge>}
                  <h2 className="text-base font-semibold text-primary-950">
                    <Link href={`/dashboard/hospitals/${opt.hospital.id}`} className="hover:underline">
                      {opt.hospital.name}
                    </Link>
                  </h2>
                </div>
                <p className="mt-0.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-slate-600">
                  <span className="inline-flex items-center gap-1">
                    <MapPin className="h-3.5 w-3.5" aria-hidden /> {opt.hospital.city}
                  </span>
                  {origin && (
                    <span className="inline-flex items-center gap-1 font-medium text-primary-800">
                      <Car className="h-3.5 w-3.5" aria-hidden /> {opt.distanceKm.toFixed(1)} km · ~{opt.etaMinutes} min
                    </span>
                  )}
                  {opt.hospital.emergencyPhone && (
                    <a href={`tel:${opt.hospital.emergencyPhone.replace(/\s/g, "")}`} className="font-medium text-red-700 hover:underline">
                      ER: {opt.hospital.emergencyPhone}
                    </a>
                  )}
                </p>
                <div className="mt-2 flex flex-wrap gap-1.5">
                  <StatusBadge status={"AVAILABLE"} label={`Reported emergency beds ${opt.hospital.beds.find(b => b.category === "EMERGENCY")?.available ?? 0}`} />
                  <StatusBadge status={(opt.hospital.services.find(s => s.key === "ICU")?.status ?? "UNKNOWN") === "UNKNOWN" ? "LIMITED" : opt.hospital.services.find(s => s.key === "ICU")!.status} label={`ICU ${opt.hospital.beds.find(b => b.category === "ICU")?.available ?? 0}`} />
                  {(opt.hospital.services.find(s => s.key === "AMBULANCE")?.status ?? "UNKNOWN") === "AVAILABLE" && (
                    <Badge variant="neutral" size="sm"><Ambulance className="h-3 w-3" aria-hidden /> Ambulance</Badge>
                  )}
                </div>
              </div>
              <div className="flex shrink-0 flex-col gap-2 sm:flex-row lg:flex-col xl:flex-row">
                <a href={`tel:${opt.hospital.phone.replace(/\s/g, "")}`}>
                  <Button variant="emergency" size="sm" className="gap-1.5">
                    <Phone className="h-4 w-4" aria-hidden /> Call
                  </Button>
                </a>
                <a
                  href={
                    origin
                      ? `https://www.google.com/maps/dir/?api=1&origin=${origin.lat},${origin.lng}&destination=${opt.hospital.lat},${opt.hospital.lng}&travelmode=driving`
                      : `https://www.google.com/maps/dir/?api=1&destination=${opt.hospital.lat},${opt.hospital.lng}&travelmode=driving`
                  }
                  target="_blank"
                  rel="noreferrer"
                >
                  <Button variant="primary" size="sm" className="gap-1.5">
                    <Car className="h-4 w-4" aria-hidden /> Directions
                  </Button>
                </a>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <p className="mt-6 rounded-lg border border-status-unavailable-border bg-status-unavailable-bg px-4 py-3 text-xs leading-relaxed text-red-800">
        In a life-threatening emergency call <strong>112</strong> or{" "}
        <strong>108</strong> immediately. This page does not dispatch care; do not wait for this website to arrange help.
      </p>
    </div>
  );
}
