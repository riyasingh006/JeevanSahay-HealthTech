"use client";

import * as React from "react";
import Link from "next/link";
import { Search, Stethoscope } from "lucide-react";
import { PageHeader } from "@/components/layout/page-header";
import { FacilityReportedNotice, DemoDataBadge } from "@/components/ui/data-source";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { SPECIALTIES } from "@/lib/constants";

type Doctor = {
  id: string;
  name: string;
  specialty: string;
  qualification: string;
  experienceYears: number;
  availability: string;
  hospital: { id: string; name: string; city: string; isDemo: boolean };
};

export default function DoctorsPage() {
  const [query, setQuery] = React.useState("");
  const [city, setCity] = React.useState("");
  const [specialty, setSpecialty] = React.useState("");
  const [doctors, setDoctors] = React.useState<Doctor[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState("");

  const search = React.useCallback(async (nextQuery: string, nextCity: string, nextSpecialty: string) => {
    setLoading(true);
    setError("");
    const params = new URLSearchParams();
    if (nextQuery.trim()) params.set("q", nextQuery.trim());
    if (nextCity.trim()) params.set("city", nextCity.trim());
    if (nextSpecialty) params.set("specialty", nextSpecialty);
    try {
      const response = await fetch(`/api/doctors?${params.toString()}`, { headers: { Accept: "application/json" }, cache: "no-store" });
      const result = await response.json();
      if (!response.ok || !result.ok) throw new Error(result.error || "Doctor directory is unavailable.");
      setDoctors(result.data.doctors as Doctor[]);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Doctor directory is unavailable.");
      setDoctors([]);
    } finally {
      setLoading(false);
    }
  }, []);

  React.useEffect(() => { void search("", "", ""); }, [search]);

  function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    void search(query, city, specialty);
  }

  return (
    <>
      <PageHeader title="Find a doctor" subtitle="Search clinicians listed by verified hospitals. Confirm appointment availability with the facility before travelling." breadcrumb={[{ label: "Home", href: "/" }, { label: "Doctors" }]} />
      <div className="container space-y-6 py-6">
        <FacilityReportedNotice />
        <Card><CardContent className="pt-5"><form onSubmit={submit} className="grid gap-3 sm:grid-cols-2 lg:grid-cols-[1.2fr_1fr_1fr_auto]">
          <label><span className="sr-only">Doctor name</span><Input value={query} maxLength={80} onChange={(event) => setQuery(event.target.value)} placeholder="Doctor name" /></label>
          <label><span className="sr-only">City</span><Input value={city} maxLength={60} onChange={(event) => setCity(event.target.value)} placeholder="City" /></label>
          <label><span className="sr-only">Specialty</span><select value={specialty} onChange={(event) => setSpecialty(event.target.value)} className="h-10 w-full rounded-lg border border-slate-300 bg-white px-3 text-sm text-slate-800"><option value="">All specialties</option>{SPECIALTIES.map((item) => <option key={item.key} value={item.key}>{item.label}</option>)}</select></label>
          <Button type="submit" loading={loading}><Search className="h-4 w-4" aria-hidden />Search</Button>
        </form></CardContent></Card>
        {error && <p role="alert" className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">{error}</p>}
        {loading ? <p role="status" className="rounded-lg border border-slate-200 bg-white px-4 py-10 text-center text-sm text-slate-500">Loading verified doctor listings…</p> : doctors.length === 0 ? <div className="rounded-xl border border-dashed border-slate-300 bg-white px-6 py-12 text-center"><Stethoscope className="mx-auto h-8 w-8 text-slate-400" aria-hidden /><h2 className="mt-3 font-semibold text-primary-950">No doctors found</h2><p className="mt-1 text-sm text-slate-600">Try a different name, city or specialty.</p></div> : <div className="grid gap-4 md:grid-cols-2">{doctors.map((doctor) => <Card key={doctor.id}><CardContent className="flex h-full flex-col pt-5"><div className="flex items-start justify-between gap-3"><div><h2 className="font-semibold text-primary-950">{doctor.name}</h2><p className="mt-1 text-sm text-care-700">{SPECIALTIES.find((item) => item.key === doctor.specialty)?.label ?? doctor.specialty}</p></div>{doctor.hospital.isDemo && <DemoDataBadge />}</div><p className="mt-3 text-sm text-slate-600">{doctor.qualification}{doctor.experienceYears ? ` · ${doctor.experienceYears} years’ experience` : ""}</p><p className="mt-1 text-sm text-slate-700">{doctor.hospital.name} · {doctor.hospital.city}</p><p className="mt-2 text-xs text-slate-500">{doctor.availability === "AVAILABLE" ? "Listed as available" : doctor.availability === "LIMITED" ? "Limited availability listed" : "Availability not listed"}</p><Link className="mt-4 inline-flex w-fit items-center rounded-lg border border-slate-300 px-3 py-2 text-sm font-semibold text-primary-800 hover:bg-primary-50" href={`/hospitals/${encodeURIComponent(doctor.hospital.id)}`}>View hospital details</Link></CardContent></Card>)}</div>}
        <p className="text-xs leading-relaxed text-slate-500">Doctor profiles and availability are maintained by hospitals and may be outdated. Jeevan Sahay does not verify clinical credentials or confirm appointment slots.</p>
      </div>
    </>
  );
}
