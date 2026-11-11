"use client";

import * as React from "react";
import Link from "next/link";
import { Bookmark, CalendarPlus, MapPin, Navigation, Phone, Trash2 } from "lucide-react";
import { Badge, LastUpdated } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState } from "@/components/ui/empty-state";
import { useToast } from "@/components/ui/toast";
import { useSavedHospitals } from "@/components/patient/save-hospital-button";
import { DirectionsDialog } from "@/components/patient/directions-dialog";
import { AppointmentDialog, type BookingDoctor } from "@/components/patient/appointment-dialog";

interface SavedRow {
  id: string;
  hospitalId: string;
  hospital: {
    id: string;
    name: string;
    city: string;
    type: string;
    phone: string;
    lat: number;
    lng: number;
    lastAvailabilityUpdate: string;
    beds: { category: string; total: number; available: number }[];
  };
}

export default function SavedPage() {
  const { refresh } = useSavedHospitals();
  const { toast } = useToast();
  const [rows, setRows] = React.useState<SavedRow[] | null>(null);
  const [directionsFor, setDirectionsFor] = React.useState<SavedRow | null>(null);
  const [bookingFor, setBookingFor] = React.useState<BookingDoctor | null>(null);

  React.useEffect(() => {
    let alive = true;
    fetch("/api/user/saved", { cache: "no-store" })
      .then((r) => r.json())
      .then((json) => {
        if (alive && json.ok) setRows(json.data.saved ?? []);
      })
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, []);

  async function remove(hospitalId: string) {
    try {
      const res = await fetch(`/api/user/saved?hospitalId=${encodeURIComponent(hospitalId)}`, {
        method: "DELETE",
      });
      const json = await res.json();
      if (!json.ok) throw new Error(json.error ?? "Failed to remove");
      toast({ title: "Removed from saved hospitals", variant: "info" });
      await refresh();
      setRows((prev) => prev?.filter((r) => r.hospitalId !== hospitalId) ?? null);
    } catch {
      toast({ title: "Could not update saved hospitals", variant: "error" });
    }
  }

  return (
    <div className="mx-auto max-w-5xl">
      <header>
        <h1 className="institutional-heading text-2xl">Saved Hospitals</h1>
        <p className="mt-1 text-sm text-slate-600">
          Your saved facilities with quick access to details and directions.
        </p>
      </header>

      {rows === null && (
        <div className="mt-6 space-y-3">
          {[0, 1].map((i) => (
            <Skeleton key={i} className="h-28 rounded-xl" />
          ))}
        </div>
      )}

      {rows !== null && rows.length === 0 && (
        <div className="mt-6">
          <EmptyState
            icon={<Bookmark className="h-6 w-6" />}
            title="You haven't saved any hospitals yet."
            description="Tap Save on any hospital card to keep it here."
            action={
              <Link href="/dashboard/hospitals">
                <Button variant="primary">Find Hospitals</Button>
              </Link>
            }
          />
        </div>
      )}

      {rows !== null && rows.length > 0 && (
        <div className="mt-6 space-y-4">
          {rows.map((row) => {
            const h = row.hospital;
            const general = h.beds.find((b) => b.category === "GENERAL");
            const icu = h.beds.find((b) => b.category === "ICU");
            return (
              <Card key={row.id}>
                <CardContent className="flex flex-wrap items-start justify-between gap-4 p-5">
                  <div className="min-w-0 flex-1">
                    <h2 className="text-base font-semibold text-primary-950">
                      <Link href={`/dashboard/hospitals/${h.id}`} className="hover:underline">
                        {h.name}
                      </Link>
                    </h2>
                    <p className="mt-1 flex items-center gap-1.5 text-xs text-slate-500">
                      <MapPin className="h-3.5 w-3.5" aria-hidden /> {h.city}
                      <span aria-hidden>·</span>
                      <a href={`tel:${h.phone.replace(/\s/g, "")}`} className="inline-flex items-center gap-1 text-care-700 hover:underline">
                        <Phone className="h-3 w-3" aria-hidden /> {h.phone}
                      </a>
                    </p>
                    <div className="mt-2 flex flex-wrap items-center gap-1.5">
                      <Badge variant={h.type === "GOVERNMENT" || h.type === "PSU" ? "saffron" : "primary"} size="sm">
                        {h.type === "GOVERNMENT" || h.type === "PSU" ? "Government" : "Private"}
                      </Badge>
                      <Badge variant={icu && icu.available > 0 ? "green" : "neutral"} size="sm">
                        ICU {icu?.available ?? "n/a"}
                      </Badge>
                      <Badge variant="primary" size="sm">
                        General {general?.available ?? "n/a"}
                      </Badge>
                      {h.lastAvailabilityUpdate && (
                        <LastUpdated at={h.lastAvailabilityUpdate} />
                      )}
                    </div>
                  </div>
                  <div className="flex min-w-0 flex-wrap gap-2 sm:shrink-0">
                    <Link href={`/dashboard/hospitals/${h.id}`}>
                      <Button variant="secondary" size="sm">Details</Button>
                    </Link>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() =>
                        setDirectionsFor({
                          ...row,
                          hospitalId: row.hospital.id,
                          id: row.id,
                          hospital: row.hospital,
                        })
                      }
                    >
                      <Navigation className="h-4 w-4" aria-hidden /> Directions
                    </Button>
                    <Button
                      variant="subtle"
                      size="sm"
                      onClick={() =>
                        setBookingFor({
                          id: `generic-${h.id}`,
                          name: "General Physician",
                          specialtyLabel: "General consultation",
                          hospitalId: h.id,
                          hospitalName: h.name,
                          hospitalPhone: h.phone,
                          hospitalCity: h.city,
                          timings: null,
                        })
                      }
                    >
                      <CalendarPlus className="h-4 w-4" aria-hidden /> Book
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      aria-label={`Remove ${h.name} from saved`}
                      className="text-red-600 hover:bg-red-50"
                      onClick={() => void remove(row.hospitalId)}
                    >
                      <Trash2 className="h-4 w-4" aria-hidden />
                    </Button>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      <DirectionsDialog
        open={directionsFor !== null}
        onOpenChange={(v) => !v && setDirectionsFor(null)}
        destination={
          directionsFor
            ? {
                id: directionsFor.hospital.id,
                name: directionsFor.hospital.name,
                lat: directionsFor.hospital.lat,
                lng: directionsFor.hospital.lng,
                city: directionsFor.hospital.city,
              }
            : null
        }
      />
      <AppointmentDialog open={bookingFor !== null} onOpenChange={(v) => !v && setBookingFor(null)} doctor={bookingFor} />
    </div>
  );
}
