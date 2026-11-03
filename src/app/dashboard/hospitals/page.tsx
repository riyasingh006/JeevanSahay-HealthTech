"use client";

import * as React from "react";
import { useRouter, useSearchParams } from "next/navigation";
import {
  AlertTriangle,
  Info,
  List,
  Loader2,
  LocateFixed,
  Map as MapIcon,
  Search,
  SlidersHorizontal,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Slider } from "@/components/ui/slider";
import { Switch } from "@/components/ui/switch";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState } from "@/components/ui/empty-state";
import { useToast } from "@/components/ui/toast";
import { SPECIALTIES, HOSPITAL_TYPES, SERVICE_CATALOG, DEFAULT_CENTER } from "@/lib/constants";
import {
  getCurrentPosition,
  loadPatientLocation,
  savePatientLocation,
  type GeoErrorKind,
} from "@/lib/patient/location";
import { PortalHospitalCard, type SearchResultItem } from "@/components/patient/hospital-result-card";
import { HospitalMapDynamic } from "@/components/patient/map-loader";
import { DirectionsDialog } from "@/components/patient/directions-dialog";
import { AppointmentDialog, type BookingDoctor } from "@/components/patient/appointment-dialog";
import { useSavedHospitals } from "@/components/patient/save-hospital-button";
import { useDebounce } from "@/components/patient/use-debounce";
import { AiFindBestHospitals } from "@/components/patient/ai-recommend-panel";

const GEO_HINTS: Record<GeoErrorKind, string> = {
  denied: "Location access was not allowed. Enter an address to search hospitals.",
  unavailable:
    "Your location could not be determined. Enter an address to search hospitals.",
  timeout: "Locating you took too long. Enter an address instead.",
  unsupported:
    "Geolocation is not supported by this browser. Enter an address to search hospitals.",
  unknown: "Could not determine your location. Enter an address instead.",
};

interface Filters {
  q: string;
  specialty: string;
  type: string;
  service: string;
  maxDistance: number;
  beds: boolean;
  emergency: boolean;
  icu: boolean;
  doctorsAvailable: boolean;
  appointments: boolean;
  rating: string;
}

const DEFAULTS: Filters = {
  q: "",
  specialty: "ALL",
  type: "ALL",
  service: "ANY",
  maxDistance: 25,
  beds: false,
  emergency: false,
  icu: false,
  doctorsAvailable: false,
  appointments: false,
  rating: "any",
};

function FindHospitalsClient() {
  const router = useRouter();
  const params = useSearchParams();
  const [filters, setFilters] = React.useState<Filters>(() => ({
    ...DEFAULTS,
    q: params.get("q") ?? "",
    specialty: params.get("specialty") ?? DEFAULTS.specialty,
    icu: params.get("icu") === "1",
    emergency: params.get("emergency") === "1",
    service: params.get("service") ?? DEFAULTS.service,
  }));
  const [location, setLocation] = React.useState<{
    lat: number;
    lng: number;
    label: string;
  } | null>(null);
  const [addressQuery, setAddressQuery] = React.useState("");
  const [geoBusy, setGeoBusy] = React.useState(false);
  const [results, setResults] = React.useState<SearchResultItem[]>([]);
  const [totalMatched, setTotalMatched] = React.useState(0);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState("");
  const [compare, setCompare] = React.useState<string[]>([]);
  const [mobileView, setMobileView] = React.useState<"list" | "map">("list");
  const [showFiltersMobile, setShowFiltersMobile] = React.useState(false);
  const [searchMode, setSearchMode] = React.useState<"manual" | "ai">("manual");
  const [directionsFor, setDirectionsFor] =
    React.useState<SearchResultItem | null>(null);
  const [bookFor, setBookFor] = React.useState<SearchResultItem | null>(null);
  const { savedIds, refresh: refreshSaved } = useSavedHospitals();
  const { toast } = useToast();
  const abortRef = React.useRef<AbortController | null>(null);

  // Restore last used location once on mount.
  React.useEffect(() => {
    const savedLoc = loadPatientLocation();
    if (savedLoc)
      setLocation({ lat: savedLoc.lat, lng: savedLoc.lng, label: savedLoc.label });
  }, []);

  // Debounced text search.
  const debouncedQ = useDebounce(filters.q, 350);

  const runSearch = React.useCallback(async () => {
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;
    setLoading(true);
    setError("");
    try {
      const p = new URLSearchParams();
      p.set("provider", "places");
      if (debouncedQ.trim()) p.set("q", debouncedQ.trim());
      if (filters.specialty !== "ALL") p.set("specialty", filters.specialty);
      if (filters.type !== "ALL") p.set("type", filters.type);
      if (filters.service !== "ANY") p.set("service", filters.service);
      if (filters.emergency) p.set("emergency", "1");
      if (filters.icu) p.set("icu", "1");
      if (filters.beds) p.set("beds", "1");
      if (location) {
        p.set("lat", String(location.lat));
        p.set("lng", String(location.lng));
      }
      p.set("maxDistance", String(filters.maxDistance));
      p.set("limit", "30");

      const res = await fetch(`/api/hospitals/search?${p}`, {
        cache: "no-store",
        signal: controller.signal,
      });
      const json = await res.json();
      if (!json.ok) throw new Error(json.error ?? "Search failed");
      setResults(json.data.results ?? []);
      setTotalMatched(json.data.totalMatched ?? 0);
    } catch (e) {
      if ((e as { name?: string })?.name === "AbortError") return;
      setError(
        e instanceof Error && e.message !== "Search failed"
          ? e.message
          : "Hospital search is temporarily unavailable. Please try again."
      );
      setResults([]);
      setTotalMatched(0);
    } finally {
      if (abortRef.current === controller) setLoading(false);
    }
  }, [
    debouncedQ,
    filters.specialty,
    filters.type,
    filters.service,
    filters.emergency,
    filters.icu,
    filters.beds,
    filters.maxDistance,
    location,
  ]);

  React.useEffect(() => {
    void runSearch();
  }, [runSearch]);

  async function locateMe() {
    setGeoBusy(true);
    try {
      const pos = await getCurrentPosition();
      const label = "My current location";
      setLocation({ ...pos, label });
      savePatientLocation({
        lat: pos.lat,
        lng: pos.lng,
        label,
        source: "device",
        savedAt: new Date().toISOString(),
      });
      toast({
        title: "Using your current location",
        description: "Ranking nearby hospitals by distance.",
        variant: "success",
      });
    } catch (e) {
      const kind = (e as { kind?: GeoErrorKind })?.kind ?? "unknown";
      toast({ title: "Location unavailable", description: GEO_HINTS[kind], variant: "warning" });
    } finally {
      setGeoBusy(false);
    }
  }

  async function resolveAddress(e?: React.FormEvent) {
    e?.preventDefault();
    const q = addressQuery.trim();
    if (q.length < 3) return;
    setGeoBusy(true);
    try {
      const res = await fetch(`/api/patient/geocode?q=${encodeURIComponent(q)}`);
      const json = await res.json();
      if (!json.ok) {
        toast({
          title: "Location lookup failed",
          description:
            json.error ??
            "We could not resolve that location. Please try a city, area or PIN code.",
          variant: "error",
        });
        return;
      }
      const first = json?.data?.results?.[0];
      if (!first) {
        toast({
          title: "Location not found",
          description:
            "We could not find that location. Try a city or PIN code, or use your current location.",
          variant: "warning",
        });
        return;
      }
      const label = `${String(first.label).split(",")[0].trim()} (from address)`;
      setLocation({ lat: first.lat, lng: first.lng, label });
      savePatientLocation({
        lat: first.lat,
        lng: first.lng,
        label: String(first.label),
        source: "address",
        savedAt: new Date().toISOString(),
      });
    } catch {
      toast({
        title: "Address lookup failed",
        description: "Please try again in a moment.",
        variant: "error",
      });
    } finally {
      setGeoBusy(false);
    }
  }

  // Manual "Search": resolve the entered location (if any), then search.
  async function handleSearch() {
    const q = addressQuery.trim();
    if (q.length >= 3) {
      await resolveAddress();
    } else {
      await runSearch();
    }
  }

  function patch(partial: Partial<Filters>) {
    setFilters((f) => ({ ...f, ...partial }));
  }

  function toggleCompare(id: string) {
    setCompare((prev) => {
      if (prev.includes(id)) return prev.filter((x) => x !== id);
      if (prev.length >= 3) {
        toast({
          title: "You can compare up to 3 hospitals",
          description: "Remove one to add another.",
          variant: "info",
        });
        return prev;
      }
      return [...prev, id];
    });
  }

  const visibleResults = React.useMemo(() => {
    let list = results;
    const live = results.some((r) => r.source === "google");
    // Google Places publishes no doctor roster. Applying this filter to live
    // results would hide every card, so it is only used for local listings.
    if (filters.doctorsAvailable && !live)
      list = list.filter((r) =>
        r.hospital.doctors.some((d) => d.availability !== "UNAVAILABLE")
      );
    if (filters.rating !== "any") {
      const min = Number(filters.rating);
      list = list.filter((r) => typeof r.rating === "number" && r.rating >= min);
    }
    return list;
  }, [results, filters.doctorsAvailable, filters.rating]);

  const hasRatings = React.useMemo(
    () => results.some((r) => typeof r.rating === "number"),
    [results]
  );
  const isLiveResults = React.useMemo(
    () => results.some((r) => r.source === "google"),
    [results]
  );

  const mapCenter = React.useMemo(() => {
    if (location) return { lat: location.lat, lng: location.lng };
    if (results[0]) return { lat: results[0].hospital.lat, lng: results[0].hospital.lng };
    return DEFAULT_CENTER;
  }, [location, results]);

  const mapMarkers = React.useMemo(
    () =>
      visibleResults.map((r) => ({
        id: r.hospital.id,
        lat: r.hospital.lat,
        lng: r.hospital.lng,
        label: r.hospital.name,
        score: r.score,
        emergency: r.hospital.services.some(
          (s) => s.key === "EMERGENCY" && s.status !== "UNAVAILABLE"
        ),
      })),
    [visibleResults]
  );

  const bookDoctor: BookingDoctor | null = React.useMemo(() => {
    if (!bookFor) return null;
    const h = bookFor.hospital;
    const firstDoc = h.doctors[0];
    return {
      id: firstDoc ? `generic-${h.id}` : `generic-${h.id}`,
      name: firstDoc ? "Consultant" : "General Physician",
      specialtyLabel: filters.specialty !== "ALL"
        ? SPECIALTIES.find((s) => s.key === filters.specialty)?.label ?? "General consultation"
        : "General consultation",
      hospitalId: h.id,
      hospitalName: h.name,
      hospitalPhone: h.phone,
      hospitalCity: h.city,
      timings: null,
    };
  }, [bookFor, filters.specialty]);

  const filtersPanel = (
    <div className="space-y-5">
      <div>
        <Label className="data-label">Hospital type</Label>
        <Select value={filters.type} onValueChange={(v) => patch({ type: v })}>
          <SelectTrigger className="mt-1.5 w-full" aria-label="Hospital type">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="ALL">All types</SelectItem>
            {HOSPITAL_TYPES.map((t) => (
              <SelectItem key={t.key} value={t.key}>{t.label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div>
        <Label className="data-label">Speciality</Label>
        <Select value={filters.specialty} onValueChange={(v) => patch({ specialty: v })}>
          <SelectTrigger className="mt-1.5 w-full" aria-label="Speciality">
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

      <div>
        <Label className="data-label">Healthcare service</Label>
        <Select value={filters.service} onValueChange={(v) => patch({ service: v })}>
          <SelectTrigger className="mt-1.5 w-full" aria-label="Service">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="ANY">Any service</SelectItem>
            {SERVICE_CATALOG.map((s) => (
              <SelectItem key={s.key} value={s.key}>{s.label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div>
        <Label className="data-label">
          Distance — up to{" "}
          <span className="text-primary-800">{filters.maxDistance} km</span>
        </Label>
        <Slider
          className="mt-3"
          value={[filters.maxDistance]}
          min={1}
          max={50}
          step={1}
          onValueChange={(v) => patch({ maxDistance: v[0] ?? 25 })}
          aria-label="Maximum distance in kilometres"
        />
        <div className="mt-1 flex justify-between text-[10px] text-slate-400">
          <span>1 km</span><span>10</span><span>25</span><span>50 km</span>
        </div>
      </div>

      <div>
        <Label className="data-label">Availability</Label>
        <div className="mt-2 space-y-3">
          {(
            [
              ["beds", "Beds available"],
              ["emergency", "Emergency available"],
              ["icu", "ICU available"],
              ["doctorsAvailable", "Doctors available"],
            ] as const
          ).map(([key, label]) => (
            <label key={key} className="flex items-center justify-between gap-3 text-sm text-slate-700">
              {label}
              <Switch checked={filters[key]} onCheckedChange={(c) => patch({ [key]: c } as Partial<Filters>)} />
            </label>
          ))}
          <label className="flex items-center justify-between gap-3 text-sm text-slate-700">
            Appointment available
            <Switch
              checked={filters.appointments}
              onCheckedChange={(c) => {
                patch({ appointments: c });
                if (c)
                  toast({
                    title: "Appointment availability unavailable",
                    description:
                      "Doctor appointment availability is currently unavailable. You can still request a slot from any hospital card.",
                    variant: "info",
                  });
              }}
            />
          </label>
        </div>
      </div>

      <div>
        <Label className="data-label">Rating</Label>
        <Select value={filters.rating} onValueChange={(v) => patch({ rating: v })}>
          <SelectTrigger className="mt-1.5 w-full" aria-label="Minimum rating">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="any">Any</SelectItem>
            <SelectItem value="4">4+</SelectItem>
            <SelectItem value="4.5">4.5+</SelectItem>
          </SelectContent>
        </Select>
        {filters.rating !== "any" && !hasRatings && (
          <p className="mt-1.5 flex items-start gap-1.5 text-[11px] leading-snug text-slate-500">
            <Info className="mt-0.5 h-3 w-3 shrink-0" aria-hidden />
            Ratings are not yet available for these facilities — results are not
            filtered by rating.
          </p>
        )}
      </div>

      <Button
        variant="ghost"
        size="sm"
        onClick={() => {
          setFilters(DEFAULTS);
          setAddressQuery("");
        }}
        className="w-full"
      >
        Reset all filters
      </Button>
    </div>
  );

  return (
    <div className="mx-auto max-w-7xl">
      {/* ---------- Page heading ---------- */}
      <header>
        <h1 className="institutional-heading text-2xl">Find Hospitals</h1>
        <p className="mt-1 text-sm text-slate-600">
          Verified hospital listings near you. Bed, doctor, and service information is facility-reported; call to confirm before travelling.
        </p>
      </header>

      {/* ---------- Search mode switch ---------- */}
      <div
        role="tablist"
        aria-label="Hospital search mode"
        className="mt-4 inline-flex rounded-xl border border-slate-200 bg-white p-1 shadow-card"
      >
        {(
          [
            ["manual", "Search Hospitals"],
            ["ai", "AI Find Best Hospitals"],
          ] as const
        ).map(([mode, label]) => (
          <button
            key={mode}
            role="tab"
            type="button"
            aria-selected={searchMode === mode}
            onClick={() => setSearchMode(mode)}
            className={`rounded-lg px-4 py-2 text-sm font-semibold transition-colors ${
              searchMode === mode
                ? mode === "ai"
                  ? "bg-gradient-to-r from-[#062B67] to-[#0B5ED7] text-white shadow-raised"
                  : "bg-primary-700 text-white shadow-raised"
                : "text-slate-600 hover:text-primary-800"
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {searchMode === "ai" ? (
        <div className="mt-5">
          <AiFindBestHospitals />
        </div>
      ) : (
        <>
      {/* ---------- Location + search ---------- */}
      <Card className="mt-4">
        <CardContent className="grid gap-3 p-4 lg:grid-cols-[minmax(260px,340px)_1fr_auto] lg:items-end">
          <form
            onSubmit={(e) => {
              e.preventDefault();
              void handleSearch();
            }}
            className="space-y-1.5"
          >
            <Label htmlFor="loc-input" className="data-label">Location</Label>
            <div className="flex gap-2">
              <Input
                id="loc-input"
                className="flex-1"
                value={addressQuery}
                onChange={(e) => setAddressQuery(e.target.value)}
                placeholder="Enter city, area, address or PIN code"
                aria-describedby="loc-active"
              />
              <Button
                type="submit"
                variant="primary"
                className="shrink-0 gap-1.5"
                disabled={geoBusy}
              >
                {geoBusy ? (
                  <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
                ) : (
                  <Search className="h-4 w-4" aria-hidden />
                )}
                Search
              </Button>
            </div>
            <p id="loc-active" className="flex items-center gap-1.5 text-xs text-slate-500">
              <MapPinDot /> Using:{" "}
              <span className="font-medium text-primary-800">
                {location?.label ?? "Default centre — New Delhi"}
              </span>
            </p>
          </form>

          <div className="space-y-1.5">
            <Label htmlFor="search-input" className="data-label">Search</Label>
            <div className="relative">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" aria-hidden />
              <Input
                id="search-input"
                className="pl-9"
                value={filters.q}
                onChange={(e) => patch({ q: e.target.value })}
                placeholder="Hospital name, speciality or service — e.g. cardiology near me"
                aria-label="Search hospitals"
              />
            </div>
          </div>

          <div className="flex flex-wrap gap-2">
            <Button
              variant="outlineSaffron"
              className="gap-2"
              onClick={() => void locateMe()}
              disabled={geoBusy}
            >
              {geoBusy ? (
                <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
              ) : (
                <LocateFixed className="h-4 w-4" aria-hidden />
              )}
              Use My Current Location
            </Button>
            <Button variant="ghost" size="icon" className="lg:hidden" aria-label="Toggle filters" onClick={() => setShowFiltersMobile((v) => !v)}>
              <SlidersHorizontal className="h-5 w-5" aria-hidden />
            </Button>
          </div>
        </CardContent>
      </Card>

      <div className="mt-5 grid gap-6 lg:grid-cols-[290px_1fr]">
        {/* ---------- Filters (desktop) ---------- */}
        <aside className="hidden lg:block" aria-label="Search filters">
          <Card className="sticky top-24">
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2 text-sm font-semibold">
                <SlidersHorizontal className="h-4 w-4" aria-hidden /> Filters
              </CardTitle>
            </CardHeader>
            <CardContent>{filtersPanel}</CardContent>
          </Card>
        </aside>

        {/* ---------- Filters (mobile collapsible) ---------- */}
        {showFiltersMobile && (
          <Card className="lg:hidden">
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2 text-sm font-semibold">
                <SlidersHorizontal className="h-4 w-4" aria-hidden /> Filters
              </CardTitle>
            </CardHeader>
            <CardContent>{filtersPanel}</CardContent>
          </Card>
        )}

        <section aria-label="Search results" className="min-w-0">
          {/* ---------- Result meta ---------- */}
          <div className="flex flex-wrap items-center justify-between gap-3">
            <p role="status" className="text-sm text-slate-600">
              Showing <strong className="tabular-nums">{visibleResults.length}</strong>{" "}
              of {totalMatched} suitable hospitals
              {filters.rating !== "any" && !hasRatings && " · ratings pending"}
            </p>
            {compare.length > 0 && (
              <Button variant="primary" size="sm" onClick={() => router.push(`/dashboard/compare?ids=${compare.join(",")}`)}>
                Compare {compare.length} selected →
              </Button>
            )}
            <div className="flex rounded-lg border border-slate-200 p-0.5 lg:hidden">
              {(["list", "map"] as const).map((v) => (
                <button
                  key={v}
                  type="button"
                  onClick={() => setMobileView(v)}
                  aria-pressed={mobileView === v}
                  className={`inline-flex items-center gap-1 rounded-md px-2.5 py-1 text-xs font-semibold capitalize ${
                    mobileView === v ? "bg-primary-700 text-white" : "text-slate-600"
                  }`}
                >
                  {v === "list" ? <List className="h-3.5 w-3.5" aria-hidden /> : <MapIcon className="h-3.5 w-3.5" aria-hidden />}
                  {v}
                </button>
              ))}
            </div>
          </div>

          <div className="mt-4 grid gap-5 xl:grid-cols-[1fr_360px]">
            {/* ---------- Cards ---------- */}
            <div className={`space-y-4 ${mobileView === "map" ? "hidden xl:block" : ""}`}>
              {loading ? (
                [0, 1, 2].map((i) => <Skeleton key={i} className="h-44 w-full rounded-xl" />)
              ) : error ? (
                <EmptyState
                  icon={<AlertTriangle className="h-6 w-6" />}
                  title="Search failed"
                  description={error}
                  action={<Button onClick={() => void runSearch()}>Retry search</Button>}
                />
              ) : visibleResults.length === 0 ? (
                <EmptyState
                  icon={<Search className="h-6 w-6" />}
                  title="No hospitals found for this location and filter combination."
                  description="Try widening the distance range or removing some filters."
                  action={
                    <Button variant="secondary" onClick={() => setFilters(DEFAULTS)}>
                      Clear filters
                    </Button>
                  }
                />
              ) : (
                visibleResults.map((item) => (
                  <PortalHospitalCard
                    key={item.hospital.id}
                    item={item}
                    saved={savedIds.has(item.hospital.id)}
                    onToggleSave={() => {
                      void refreshSaved();
                    }}
                    onCompare={toggleCompare}
                    compareChecked={compare.includes(item.hospital.id)}
                    onDirections={setDirectionsFor}
                    onBook={setBookFor}
                  />
                ))
              )}
              {!loading && !error && visibleResults.length > 0 && !isLiveResults && (
                <p className="pt-1 text-[11px] leading-relaxed text-slate-400">
                  Bed counts come from the Jeevan Sahay sample dataset maintained
                  manually by participating facilities — verify by phone before
                  travelling.
                </p>
              )}
              {!loading && !error && visibleResults.length > 0 && isLiveResults && (
                <p className="pt-1 text-[11px] leading-relaxed text-slate-400">
                  Hospital details are provided by Google Places. Bed counts, ICU
                  availability and specialist data are not published by this source —
                  confirm by phone before travelling.
                </p>
              )}
              {!loading && !error && visibleResults.length > 0 && isLiveResults && filters.doctorsAvailable && (
                <p className="pt-1 text-[11px] leading-relaxed text-slate-400">
                  Google does not publish per-doctor availability, so the
                  &ldquo;Doctors available&rdquo; filter is ignored for live results.
                </p>
              )}
            </div>

            {/* ---------- Map ---------- */}
            <div className={`${mobileView === "list" ? "hidden xl:block" : ""}`}>
              <Card className="sticky top-24 overflow-hidden">
                <div className="map-shell h-[320px] xl:h-[560px]">
                  <HospitalMapDynamic
                    center={mapCenter}
                    markers={mapMarkers}
                    userLocation={location}
                  />
                </div>
                <CardContent className="flex flex-wrap items-center justify-between gap-2 py-3 text-xs text-slate-500">
                  <span className="inline-flex items-center gap-1.5">
                    <Badge variant="green" size="sm">Navy pin</Badge> hospital
                  </span>
                  <span className="inline-flex items-center gap-1.5">
                    <span className="inline-block h-2.5 w-2.5 rounded-full bg-[#B42318]" /> emergency-capable
                  </span>
                  <span className="inline-flex items-center gap-1.5">
                    <span className="inline-block h-2.5 w-2.5 rounded-full bg-care-500" /> you
                  </span>
                </CardContent>
              </Card>
            </div>
          </div>
        </section>
      </div>

        </>
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

      <AppointmentDialog
        open={bookFor !== null}
        onOpenChange={(v) => !v && setBookFor(null)}
        doctor={bookDoctor}
      />
    </div>
  );
}

function MapPinDot() {
  return <span className="inline-block h-2 w-2 rounded-full bg-care-500" aria-hidden />;
}

export default function FindHospitalsPage() {
  return (
    <React.Suspense
      fallback={
        <div className="mx-auto max-w-7xl space-y-4">
          <Skeleton className="h-20 w-full rounded-xl" />
          {[0, 1, 2].map((i) => (
            <Skeleton key={i} className="h-44 w-full rounded-xl" />
          ))}
        </div>
      }
    >
      <FindHospitalsClient />
    </React.Suspense>
  );
}
