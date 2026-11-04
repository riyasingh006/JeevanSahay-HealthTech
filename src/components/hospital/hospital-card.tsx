"use client";

import * as React from "react";
import Link from "next/link";
import {
  Bookmark,
  BookmarkCheck,
  Car,
  MapPin,
  Phone,
  Route as RouteIcon,
  ShieldCheck,
} from "lucide-react";
import { Badge, LastUpdated, StatusBadge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/toast";
import { useAuth } from "@/components/auth-context";
import { formatDistance } from "@/lib/utils";

export interface HospitalResultItem {
  hospital: {
    id: string;
    name: string;
    type: string;
    city: string;
    phone: string;
    lat?: number;
    lng?: number;
    lastAvailabilityUpdate?: string | Date;
    beds: { category: string; total: number; available: number }[];
    services: { key: string; status: string }[];
    doctors: { specialty: string; availability: string; experienceYears?: number }[];
  };
  score: number;
  distanceKm: number;
  etaMinutes: number;
  reasons?: string[];
}

export function ScorePill({ score }: { score: number }) {
  const tone =
    score >= 80
      ? "border-india-200 bg-status-available-bg text-india-600"
      : score >= 60
        ? "border-saffron-200 bg-saffron-50 text-saffron-700"
        : "border-slate-200 bg-slate-50 text-slate-500";
  return (
    <span
      className={`inline-flex h-12 w-12 flex-col items-center justify-center rounded-lg border ${tone}`}
      title={`${score}% suitability match`}
      aria-label={`Suitability score ${score} percent`}
    >
      <span className="text-sm font-bold leading-none">{score}</span>
      <span className="mt-0.5 text-[8px] font-semibold uppercase tracking-wide opacity-75">
        match
      </span>
    </span>
  );
}

export function HospitalCard({
  item,
  saved = false,
  onToggleSave,
  onCompare,
  compareChecked = false,
}: {
  item: HospitalResultItem;
  saved?: boolean;
  onToggleSave?: (id: string, next: boolean) => void;
  onCompare?: (id: string) => void;
  compareChecked?: boolean;
}) {
  const h = item.hospital;
  const icu = h.beds.find((b) => b.category === "ICU");
  const general = h.beds.find((b) => b.category === "GENERAL");
  const emergencySvc = h.services.find((s) => s.key === "EMERGENCY");
  const { user } = useAuth();
  const { toast } = useToast();

  const toggleSave = async () => {
    if (!user) {
      toast({
        title: "Login required",
        description: "Please sign in to save hospitals to your dashboard.",
        variant: "info",
      });
      return;
    }
    if (!onToggleSave) return;
    try {
      if (!saved) {
        await fetch("/api/user/saved", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ hospitalId: h.id }),
        });
        toast({ title: `${h.name} saved`, variant: "success" });
      } else {
        await fetch(`/api/user/saved?hospitalId=${h.id}`, { method: "DELETE" });
        toast({ title: `Removed from saved`, variant: "info" });
      }
      onToggleSave(h.id, !saved);
    } catch {
      toast({
        title: "Could not update saved list",
        description: "Please try again.",
        variant: "error",
      });
    }
  };

  return (
    <article className="rounded-xl border border-slate-200 bg-white p-5 shadow-card transition-shadow hover:shadow-raised">
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <Link
              href={`/hospitals/${h.id}`}
              className="text-base font-semibold text-primary-900 hover:text-care-600 hover:underline underline-offset-2"
            >
              {h.name}
            </Link>
            <Badge variant="green" size="sm">
              <ShieldCheck className="h-3 w-3" aria-hidden /> Verified
            </Badge>
            <Badge variant="primary" size="sm">
              {h.type}
            </Badge>
          </div>
          <p className="mt-1.5 flex items-center gap-1.5 text-xs text-slate-500">
            <MapPin className="h-3.5 w-3.5 shrink-0 text-slate-400" aria-hidden />
            {h.city}
            <span aria-hidden>·</span> {formatDistance(item.distanceKm)}
            <span aria-hidden>·</span>
            <Car className="h-3.5 w-3.5 shrink-0 text-slate-400" aria-hidden />
            {item.etaMinutes} min ETA
          </p>
          <div className="mt-2.5 hidden flex-wrap gap-1.5 sm:flex">
            {(item.reasons ?? []).slice(0, 3).map((r) => (
              <Badge key={r} variant="neutral" size="sm">
                {r}
              </Badge>
            ))}
          </div>
        </div>
        <ScorePill score={item.score} />
      </div>

      {/* Availability strip */}
      <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-4">
        <MiniStat
          label="General Beds"
          value={`${general?.available ?? 0}/${general?.total ?? 0}`}
          status={general && general.available > 8 ? "AVAILABLE" : "LIMITED"}
        />
        <MiniStat
          label="ICU"
          value={`${icu?.available ?? 0}/${icu?.total ?? 0}`}
          status={icu && icu.available > 0 ? (icu.available > 3 ? "AVAILABLE" : "LIMITED") : "UNAVAILABLE"}
        />
        <MiniStat
          label="Emergency"
          value={emergencySvc?.status === "UNAVAILABLE" ? "Closed" : emergencySvc?.status === "LIMITED" ? "Limited" : "Active"}
          status={emergencySvc?.status ?? "UNKNOWN"}
        />
        <MiniStat
          label="Specialists"
          value={`${h.doctors.filter((d) => d.availability !== "UNAVAILABLE").length} on duty`}
          status={h.doctors.some((d) => d.availability === "AVAILABLE") ? "AVAILABLE" : "LIMITED"}
        />
      </div>

      <div className="mt-3.5 flex flex-wrap items-center justify-between gap-3 border-t border-slate-100 pt-3.5">
        <LastUpdated at={h.lastAvailabilityUpdate ?? null} />
        <div className="flex flex-wrap items-center gap-2">
          {onCompare && (
            <label className="flex cursor-pointer items-center gap-1.5 text-xs font-medium text-slate-600 hover:text-primary-800">
              <input
                type="checkbox"
                checked={compareChecked}
                onChange={() => onCompare(h.id)}
                className="h-3.5 w-3.5 accent-care-600"
                aria-label={`Add ${h.name} to comparison`}
              />
              Compare
            </label>
          )}
          <Button variant="ghost" size="sm" onClick={toggleSave}>
            {saved ? (
              <>
                <BookmarkCheck className="h-4 w-4 text-care-600" aria-hidden /> Saved
              </>
            ) : (
              <>
                <Bookmark className="h-4 w-4" aria-hidden /> Save
              </>
            )}
          </Button>
          <a href={`tel:${(h.phone || "").replace(/\s/g, "")}`}>
            <Button variant="secondary" size="sm">
              <Phone className="h-4 w-4" aria-hidden /> Call
            </Button>
          </a>
          <Link href={`/navigate/${h.id}`}>
            <Button variant="subtle" size="sm">
              <RouteIcon className="h-4 w-4" aria-hidden /> Navigate
            </Button>
          </Link>
          <Link href={`/hospitals/${h.id}`}>
            <Button variant="primary" size="sm">
              View Details
            </Button>
          </Link>
        </div>
      </div>
    </article>
  );
}

function MiniStat({
  label,
  value,
  status,
}: {
  label: string;
  value: string;
  status: string;
}) {
  return (
    <div className="rounded-lg border border-slate-100 bg-paper px-3 py-2">
      <p className="data-label">{label}</p>
      <p className="mt-0.5 text-sm font-bold text-primary-900">{value}</p>
      <StatusBadge status={status} className="mt-1 scale-90 origin-left" />
    </div>
  );
}
