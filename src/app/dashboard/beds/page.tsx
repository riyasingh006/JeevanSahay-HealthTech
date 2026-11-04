"use client";

import * as React from "react";
import Link from "next/link";
import { BedDouble, RefreshCcw } from "lucide-react";
import { LastUpdated, StatusBadge } from "@/components/ui/badge";
import { DemoDataBadge, DemoFacilityNotice, FacilityReportedNotice } from "@/components/ui/data-source";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState } from "@/components/ui/empty-state";
import type { SearchResultItem } from "@/components/patient/hospital-result-card";

function bed(r: SearchResultItem, cat: string) {
  return r.hospital.beds.find((b) => b.category === cat);
}

export default function BedsPage() {
  const [results, setResults] = React.useState<SearchResultItem[] | null>(null);
  const [failed, setFailed] = React.useState(false);
  const [cityFilter, setCityFilter] = React.useState("");
  const [onlyAvailable, setOnlyAvailable] = React.useState(true);

  const load = React.useCallback(() => {
    let alive = true;
    setFailed(false);
    const p = new URLSearchParams();
    p.set("maxDistance", "100");
    p.set("limit", "50");
    fetch(`/api/hospitals/search?${p}`, { cache: "no-store" })
      .then((r) => r.json())
      .then((json) => {
        if (!alive) return;
        if (json.ok) setResults(json.data.results ?? []);
        else setFailed(true);
      })
      .catch(() => alive && setFailed(true));
    return () => {
      alive = false;
    };
  }, []);

  React.useEffect(() => void load(), [load]);

  const rows = React.useMemo(() => {
    let list = results ?? [];
    if (cityFilter.trim())
      list = list.filter((r) =>
        r.hospital.city.toLowerCase().includes(cityFilter.trim().toLowerCase())
      );
    if (onlyAvailable) list = list.filter((r) => (bed(r, "GENERAL")?.available ?? 0) > 0 || (bed(r, "ICU")?.available ?? 0) > 0);
    return list;
  }, [results, cityFilter, onlyAvailable]);

  const totals = React.useMemo(() => {
    let generalAvail = 0, icuAvail = 0, emergencyAvail = 0;
    for (const r of rows) {
      generalAvail += bed(r, "GENERAL")?.available ?? 0;
      icuAvail += bed(r, "ICU")?.available ?? 0;
      emergencyAvail += bed(r, "EMERGENCY")?.available ?? 0;
    }
    return { generalAvail, icuAvail, emergencyAvail };
  }, [rows]);

  return (
    <div className="mx-auto max-w-6xl">
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="institutional-heading text-2xl">Reported Bed Counts</h1>
          <p className="mt-1 text-sm text-slate-600">
            Facility-reported general, ICU and emergency bed counts. Confirm directly before travelling.
          </p>
        </div>
        <Button variant="secondary" size="sm" className="gap-1.5" onClick={() => load()}>
          <RefreshCcw className="h-3.5 w-3.5" aria-hidden /> Refresh
        </Button>
      </header>

      <div className="mt-4"><FacilityReportedNotice /></div>
      {rows.some((row) => row.hospital.isDemo) && <DemoFacilityNotice />}

      {/* Summary */}
      <section aria-label="Availability summary" className="mt-4 grid gap-4 sm:grid-cols-3">
        {[
          { label: "Reported general beds available", value: results ? totals.generalAvail : undefined },
          { label: "Reported ICU beds available", value: results ? totals.icuAvail : undefined },
          { label: "Reported emergency beds available", value: results ? totals.emergencyAvail : undefined },
        ].map(({ label, value }) => (
          <Card key={label} className="border-l-4 border-l-care-600">
            <CardContent className="p-5">
              <span className="block text-2xl font-bold tabular-nums text-primary-950">
                {value === undefined ? <Skeleton className="h-8 w-14" /> : value}
              </span>
              <span className="data-label mt-1 block">{label}</span>
            </CardContent>
          </Card>
        ))}
      </section>

      {/* Filters */}
      <div className="mt-5 flex flex-wrap items-end gap-3">
        <div className="space-y-1.5">
          <Label htmlFor="bed-city" className="data-label">City</Label>
          <Input
            id="bed-city"
            value={cityFilter}
            onChange={(e) => setCityFilter(e.target.value)}
            placeholder="e.g. New Delhi"
            className="w-52"
          />
        </div>
        <label className="mb-1 flex items-center gap-2 pb-2.5 text-sm text-slate-700">
          <input
            type="checkbox"
            checked={onlyAvailable}
            onChange={(e) => setOnlyAvailable(e.target.checked)}
            className="h-4 w-4 accent-care-600"
          />
          Only show hospitals with reported available counts
        </label>
      </div>

      {failed && (
        <div className="mt-6">
          <EmptyState
            title="Bed availability information is currently unavailable."
            description="Hospital search is temporarily unavailable. Please try again."
            action={<Button onClick={() => load()}>Retry</Button>}
          />
        </div>
      )}

      {!failed && results === null && (
        <div className="mt-6 space-y-3">
          {[0, 1, 2].map((i) => (
            <Skeleton key={i} className="h-16 rounded-xl" />
          ))}
        </div>
      )}

      {!failed && results !== null && rows.length === 0 && (
        <div className="mt-6">
          <EmptyState
            icon={<BedDouble className="h-6 w-6" />}
            title="No hospitals match this filter."
            description="Try clearing the city filter or including full hospitals."
          />
        </div>
      )}

      {!failed && rows.length > 0 && (
        <Card className="mt-4 overflow-x-auto">
          <table className="w-full min-w-[760px] text-left text-sm" aria-label="Bed availability by hospital">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50 text-xs uppercase tracking-wider text-slate-500">
                <th scope="col" className="px-4 py-3 font-semibold">Hospital</th>
                <th scope="col" className="px-4 py-3 font-semibold">General</th>
                <th scope="col" className="px-4 py-3 font-semibold">ICU</th>
                <th scope="col" className="px-4 py-3 font-semibold">Emergency</th>
                <th scope="col" className="px-4 py-3 font-semibold">Ventilator</th>
                <th scope="col" className="px-4 py-3 font-semibold">Last updated</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.hospital.id} className="border-b border-slate-100 last:border-0 hover:bg-primary-50/40">
                  <td className="max-w-64 px-4 py-3">
                    <div className="flex flex-wrap items-center gap-2">
                      <Link href={`/dashboard/hospitals/${r.hospital.id}`} className="font-medium text-primary-900 hover:underline">
                        {r.hospital.name}
                      </Link>
                      {r.hospital.isDemo && <DemoDataBadge />}
                    </div>
                    <span className="block text-xs text-slate-500">
                      {r.hospital.city}
                    </span>
                  </td>
                  {(["GENERAL", "ICU", "EMERGENCY", "VENTILATOR"] as const).map((cat) => {
                    const b = bed(r, cat);
                    return (
                      <td key={cat} className="px-4 py-3">
                        {b ? (
                          <span className="tabular-nums font-medium text-primary-950">
                            {b.available}
                            <span className="text-xs font-normal text-slate-400"> / {b.total}</span>
                          </span>
                        ) : (
                          <StatusBadge status="UNAVAILABLE" label="N/A" />
                        )}
                      </td>
                    );
                  })}
                  <td className="px-4 py-3">
                    {r.hospital.lastAvailabilityUpdate && (
                      <LastUpdated at={r.hospital.lastAvailabilityUpdate} />
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
      )}
    </div>
  );
}
