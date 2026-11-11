"use client";

import * as React from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import {
  CalendarPlus,
  GraduationCap,
  Languages as LanguagesIcon,
  MapPin,
  Search,
  Stethoscope,
} from "lucide-react";
import { Badge, StatusBadge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState } from "@/components/ui/empty-state";
import { DemoDataBadge, DemoFacilityNotice, FacilityReportedNotice } from "@/components/ui/data-source";
import { SPECIALTIES, DOCTOR_AVAILABILITY_LABEL } from "@/lib/constants";
import { AppointmentDialog, type BookingDoctor } from "@/components/patient/appointment-dialog";
import { useDebounce } from "@/components/patient/use-debounce";

interface DoctorRow {
  id: string;
  name: string;
  specialty: string;
  department: string | null;
  qualification: string | null;
  experienceYears: number;
  availability: string;
  timings: string | null;
  languages: string | null;
  hospital: {
    id: string;
    name: string;
    city: string;
    type: string;
    isDemo: boolean;
  };
}

/** Stored names already include the "Dr." title, so strip a leading one to
 * avoid rendering "Dr. Dr. …". Names without a title are left untouched. */
function displayName(name: string): string {
  return name.replace(/^dr\.?\s+/i, "").trim();
}

function DoctorsClient() {
  const params = useSearchParams();
  const [q, setQ] = React.useState(params.get("q") ?? "");
  const [specialty, setSpecialty] = React.useState(
    params.get("specialty") ?? "ALL"
  );
  const [city, setCity] = React.useState("");
  const [doctors, setDoctors] = React.useState<DoctorRow[]>([]);
  const [failed, setFailed] = React.useState(false);
  const [loading, setLoading] = React.useState(true);
  const [booking, setBooking] = React.useState<BookingDoctor | null>(null);
  const [reloadKey, setReloadKey] = React.useState(0);

  const debouncedQ = useDebounce(q, 350);
  const debouncedCity = useDebounce(city, 350);

  React.useEffect(() => {
    let alive = true;
    setFailed(false);
    setLoading(true);
    const p = new URLSearchParams();
    if (debouncedQ.trim()) p.set("q", debouncedQ.trim());
    if (specialty !== "ALL") p.set("specialty", specialty);
    if (debouncedCity.trim()) p.set("city", debouncedCity.trim());
    fetch(`/api/doctors?${p}`, { cache: "no-store" })
      .then((r) => r.json())
      .then((json) => {
        if (!alive) return;
        if (json.ok) {
          setDoctors(json.data.doctors ?? []);
        } else {
          setDoctors([]);
          setFailed(true);
        }
        setLoading(false);
      })
      .catch(() => {
        if (!alive) return;
        setDoctors([]);
        setFailed(true);
        setLoading(false);
      });
    return () => {
      alive = false;
    };
  }, [debouncedQ, debouncedCity, specialty, reloadKey]);

  return (
    <div className="mx-auto max-w-6xl">
      <header>
        <h1 className="institutional-heading text-2xl">Find a Doctor</h1>
        <p className="mt-1 text-sm text-slate-600">
          Doctors listed by verified hospitals. Availability is facility-reported; confirm directly before travelling.
        </p>
      </header>
      <div className="mt-4"><FacilityReportedNotice /></div>
      {doctors.some((doctor) => doctor.hospital.isDemo) && <DemoFacilityNotice />}

      <Card className="mt-4">
        <CardContent className="grid gap-3 p-4 md:grid-cols-[1fr_220px_180px]">
          <div className="space-y-1.5">
            <Label htmlFor="doc-q" className="data-label">Search</Label>
            <div className="relative">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" aria-hidden />
              <Input
                id="doc-q"
                className="pl-9"
                value={q}
                onChange={(e) => setQ(e.target.value)}
                placeholder="Doctor name"
                aria-label="Search doctors by name"
              />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label className="data-label">Speciality</Label>
            <Select value={specialty} onValueChange={setSpecialty}>
              <SelectTrigger className="w-full" aria-label="Speciality">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="ALL">All specialities</SelectItem>
                {SPECIALTIES.map((s) => (
                  <SelectItem key={s.key} value={s.key}>{s.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="doc-city" className="data-label">City</Label>
            <Input
              id="doc-city"
              value={city}
              onChange={(e) => setCity(e.target.value)}
              placeholder="e.g. New Delhi"
            />
          </div>
        </CardContent>
      </Card>

      <p role="status" className="mt-4 text-sm text-slate-600">
        {loading ? "Loading…" : failed ? "" : `${doctors.length} doctor${doctors.length === 1 ? "" : "s"} found`}
      </p>

      <div className="mt-3 grid min-w-0 grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
        {loading &&
          !failed &&
          [0, 1, 2, 3, 4, 5].map((i) => <Skeleton key={i} className="h-52 rounded-xl" />)}

        {!loading && !failed && doctors.length === 0 && (
          <div className="md:col-span-2 xl:col-span-3">
            <EmptyState
              icon={<Stethoscope className="h-6 w-6" />}
              title="No doctors found"
              description="Doctor appointment availability is currently unavailable for this combination. Try clearing filters."
            />
          </div>
        )}

        {failed && (
          <div className="md:col-span-2 xl:col-span-3">
              <EmptyState
                title="Could not load doctors"
                description="Please try again in a moment."
                action={<Button onClick={() => setReloadKey((k) => k + 1)}>Retry</Button>}
              />
          </div>
        )}

        {!failed &&
          doctors.map((d) => {
            const spec = SPECIALTIES.find((s) => s.key === d.specialty);
            return (
              <Card key={d.id} className="flex flex-col">
                <CardContent className="flex flex-1 flex-col gap-2 p-5">
                  <div className="flex items-start justify-between gap-2">
                    <h2 className="text-base font-semibold text-primary-950">Dr. {displayName(d.name)}</h2>
                    <div className="flex flex-wrap items-center gap-1.5">
                      {d.hospital.isDemo && <DemoDataBadge />}
                      <StatusBadge status={d.availability} />
                    </div>
                  </div>
                <p className="text-sm font-medium text-care-700">
                  {spec?.label ?? d.specialty}
                  {d.department ? ` · ${d.department}` : ""}
                </p>
                {d.qualification && (
                  <p className="flex items-center gap-1.5 text-xs text-slate-500">
                    <GraduationCap className="h-3.5 w-3.5" aria-hidden /> {d.qualification} ·{" "}
                    {d.experienceYears}+ yrs experience
                  </p>
                )}
                {d.timings && (
                  <p className="text-xs text-slate-500">{d.timings}</p>
                )}
                {d.languages && (
                  <p className="flex items-center gap-1.5 text-xs text-slate-500">
                    <LanguagesIcon className="h-3.5 w-3.5" aria-hidden /> {d.languages}
                  </p>
                )}
                <div className="mt-auto space-y-2 pt-2">
                  <Link
                    href={`/dashboard/hospitals/${d.hospital.id}`}
                    className="flex items-center gap-1.5 text-sm font-medium text-primary-800 hover:underline"
                  >
                    <MapPin className="h-3.5 w-3.5 shrink-0" aria-hidden />
                    <span className="truncate">{d.hospital.name}, {d.hospital.city}</span>
                  </Link>
                  <Badge variant={d.hospital.type === "GOVERNMENT" || d.hospital.type === "PSU" ? "saffron" : "primary"} size="sm">
                    {d.hospital.type === "GOVERNMENT" || d.hospital.type === "PSU" ? "Government" : "Private"} hospital
                  </Badge>
                  <Button
                    variant="primary"
                    size="sm"
                    className="w-full gap-1.5"
                    disabled={d.hospital.isDemo || d.availability === "UNAVAILABLE"}
                    onClick={() =>
                      setBooking({
                        id: d.id,
                        name: displayName(d.name),
                        specialty: d.specialty,
                        specialtyLabel: spec?.label ?? d.specialty,
                        qualification: d.qualification,
                        hospitalId: d.hospital.id,
                        hospitalName: d.hospital.name,
                        hospitalCity: d.hospital.city,
                        timings: d.timings,
                      })
                    }
                  >
                    <CalendarPlus className="h-4 w-4" aria-hidden />
                    {d.hospital.isDemo
                      ? "Sample data — booking disabled"
                      : d.availability === "UNAVAILABLE"
                        ? "Not available"
                        : DOCTOR_AVAILABILITY_LABEL[d.availability] ?? "Book"}
                  </Button>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      <AppointmentDialog
        open={booking !== null}
        onOpenChange={(v) => !v && setBooking(null)}
        doctor={booking}
      />
    </div>
  );
}

export default function DoctorsPage() {
  return (
    <React.Suspense fallback={null}>
      <DoctorsClient />
    </React.Suspense>
  );
}
