"use client";

import * as React from "react";
import Link from "next/link";
import { AlertTriangle, LocateFixed, MapPin, Phone, Siren } from "lucide-react";
import { PageHeader } from "@/components/layout/page-header";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { FacilityReportedNotice } from "@/components/ui/data-source";

type EmergencyOption = {
  hospital: { id: string; name: string; city: string; state: string; addressLine: string; phone: string; lat: number; lng: number; beds: Array<{ category: string; available: number }> };
  score: number;
  distanceKm: number;
  etaMinutes: number;
  reasons: string[];
};

export default function EmergencyPage() {
  const [condition, setCondition] = React.useState("");
  const [origin, setOrigin] = React.useState<{ lat: number; lng: number } | null>(null);
  const [options, setOptions] = React.useState<EmergencyOption[] | null>(null);
  const [urgency, setUrgency] = React.useState("");
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState("");

  function locate() {
    setError("");
    if (!navigator.geolocation) { setError("Location access is not available in this browser."); return; }
    navigator.geolocation.getCurrentPosition(
      (position) => setOrigin({ lat: position.coords.latitude, lng: position.coords.longitude }),
      () => setError("Location was not shared. You can still search by describing the emergency and choosing a hospital from the results."),
      { enableHighAccuracy: false, timeout: 8000, maximumAge: 60_000 },
    );
  }

  async function search(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);
    setError("");
    setOptions(null);
    try {
      const response = await fetch("/api/emergency/options", {
        method: "POST",
        headers: { "Content-Type": "application/json", Accept: "application/json" },
        body: JSON.stringify({ condition, ...(origin ?? {}) }),
      });
      const result = await response.json();
      if (!response.ok || !result.ok) throw new Error(result.error || "Emergency directory search is unavailable.");
      setOptions(result.data.options as EmergencyOption[]);
      setUrgency(String(result.data.urgency || ""));
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Emergency directory search is unavailable.");
    } finally {
      setLoading(false);
    }
  }

  return <><PageHeader title="Emergency care directory" subtitle="Find facilities that report emergency services. This directory does not dispatch help or confirm current capacity." breadcrumb={[{ label: "Home", href: "/" }, { label: "Emergency care" }]} /><div className="container grid gap-5 py-6 lg:grid-cols-[minmax(0,1.4fr)_minmax(260px,0.8fr)]"><div className="space-y-5"><div role="alert" className="rounded-xl border border-red-300 bg-red-50 p-4 text-red-950"><div className="flex items-start gap-3"><AlertTriangle className="mt-0.5 h-5 w-5 shrink-0" aria-hidden /><div><p className="font-semibold">If this is an emergency, call 112 now.</p><p className="mt-1 text-sm leading-relaxed">Do not wait for search results or rely on availability shown here. Jeevan Sahay is a directory, not an emergency-response service.</p><a href="tel:112" className="mt-3 inline-flex items-center gap-2 rounded-lg bg-red-700 px-4 py-2 text-sm font-semibold text-white hover:bg-red-800"><Phone className="h-4 w-4" aria-hidden />Call 112</a></div></div></div><FacilityReportedNotice /><Card><CardHeader><CardTitle>Search the verified directory</CardTitle><CardDescription>Describe the care needed in a few words. Do not include a patient’s name or other identifying details.</CardDescription></CardHeader><CardContent><form onSubmit={search} className="space-y-4"><label htmlFor="emergency-condition" className="block text-sm font-medium text-primary-950">Care needed</label><Input id="emergency-condition" minLength={2} maxLength={200} required value={condition} onChange={(event) => setCondition(event.target.value)} placeholder="For example: severe chest pain" /><div className="flex flex-wrap items-center gap-3"><Button type="submit" loading={loading}><Siren className="h-4 w-4" aria-hidden />{loading ? "Searching…" : "Search emergency directory"}</Button><Button type="button" variant="secondary" onClick={locate} disabled={loading}><LocateFixed className="h-4 w-4" aria-hidden />{origin ? "Location added" : "Use my location"}</Button>{origin && <span className="text-xs text-slate-600">Approximate location shared for this search.</span>}</div>{error && <p role="alert" className="text-sm text-red-700">{error}</p>}</form></CardContent></Card>{options && <section aria-live="polite" className="space-y-3"><div><h2 className="text-xl font-semibold text-primary-950">{options.length ? "Directory matches" : "No directory matches"}</h2><p className="mt-1 text-sm text-slate-600">{urgency ? `Search classification: ${urgency}. ` : ""}Ranked from facility-reported services and records; call before travelling.</p></div>{options.length ? options.map((option) => { const hospital = option.hospital; const directions = `https://www.google.com/maps/search/?api=1&query=${hospital.lat},${hospital.lng}`; const emergencyBeds = hospital.beds.find((bed) => bed.category === "EMERGENCY")?.available ?? 0; return <Card key={hospital.id}><CardContent className="space-y-3 pt-5"><div className="flex flex-wrap items-start justify-between gap-3"><div><h3 className="text-lg font-semibold text-primary-950">{hospital.name}</h3><p className="mt-1 flex items-start gap-1.5 text-sm text-slate-600"><MapPin className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />{hospital.addressLine}, {hospital.city}, {hospital.state}</p></div><span className="rounded-full bg-primary-50 px-3 py-1 text-xs font-semibold text-primary-800">{origin ? `${option.distanceKm.toFixed(1)} km · estimated ${option.etaMinutes} min` : "Distance estimate unavailable — share location to calculate"}</span></div><p className="text-sm text-slate-700">Facility-reported emergency beds: {emergencyBeds}</p><ul className="flex flex-wrap gap-2">{option.reasons.map((reason) => <li key={reason} className="rounded-full bg-slate-100 px-2.5 py-1 text-xs text-slate-700">{reason}</li>)}</ul><div className="flex flex-wrap gap-2">{hospital.phone && <a href={`tel:${hospital.phone.replace(/[^+\d]/g, "")}`} className="inline-flex h-9 items-center gap-2 rounded-lg bg-primary-700 px-3 text-sm font-semibold text-white hover:bg-primary-800"><Phone className="h-4 w-4" aria-hidden />Call facility</a>}<a href={directions} target="_blank" rel="noreferrer" className="inline-flex h-9 items-center rounded-lg border border-slate-300 px-3 text-sm font-medium text-primary-800 hover:bg-primary-50">Directions</a><Link href={`/hospitals/${encodeURIComponent(hospital.id)}`} className="inline-flex h-9 items-center rounded-lg px-3 text-sm font-semibold text-care-700 hover:underline">Hospital details</Link></div></CardContent></Card>}) : <p className="rounded-lg border border-dashed border-slate-300 bg-white p-5 text-sm text-slate-600">No verified facility matched this search. Call 112 for urgent assistance.</p>}</section>}</div><aside className="space-y-4"><Card><CardHeader><CardTitle>What this search can and cannot tell you</CardTitle></CardHeader><CardContent className="space-y-3 text-sm leading-relaxed text-slate-600"><p>Matches are based on the hospital directory, facility-reported service details and recorded emergency-bed counts. They are not real-time confirmations of staff, openings, or suitability.</p><p>Distance and journey time are estimates, not a route or guarantee. Contact the facility directly before travelling if it is safe to do so.</p><Link href="/hospitals?emergency=1" className="font-semibold text-care-700 hover:underline">Browse emergency-listed hospitals</Link></CardContent></Card></aside></div></>;
}
