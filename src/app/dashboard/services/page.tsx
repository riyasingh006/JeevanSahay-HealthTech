"use client";

import * as React from "react";
import Link from "next/link";
import { ArrowRight, HeartPulse } from "lucide-react";
import { Badge, StatusBadge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState } from "@/components/ui/empty-state";
import { SERVICE_CATALOG } from "@/lib/constants";
import { DemoFacilityNotice, FacilityReportedNotice } from "@/components/ui/data-source";
import type { SearchResultItem } from "@/components/patient/hospital-result-card";

type Status = "AVAILABLE" | "LIMITED" | "UNAVAILABLE";

export default function ServicesPage() {
  const [results, setResults] = React.useState<SearchResultItem[] | null>(null);
  const [failed, setFailed] = React.useState(false);

  React.useEffect(() => {
    let alive = true;
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

  const byService = React.useMemo(() => {
    const map = new Map<string, { available: number; limited: number; hospitals: number }>();
    for (const s of SERVICE_CATALOG)
      map.set(s.key, { available: 0, limited: 0, hospitals: 0 });
    for (const r of results ?? []) {
      for (const s of r.hospital.services) {
        const entry = map.get(s.key);
        if (!entry) continue;
        entry.hospitals += 1;
        if (s.status === "AVAILABLE") entry.available += 1;
        else if (s.status === "LIMITED") entry.limited += 1;
      }
    }
    return map;
  }, [results]);

  return (
    <div className="mx-auto max-w-6xl">
      <header>
        <h1 className="institutional-heading text-2xl">Healthcare Services</h1>
        <p className="mt-1 text-sm text-slate-600">
          Services listed by verified hospitals. Status is entered by each facility; confirm directly before travelling.
        </p>
      </header>
      <div className="mt-4"><FacilityReportedNotice /></div>
      {results?.some((item) => item.hospital.isDemo) && <DemoFacilityNotice />}

      {failed && (
        <div className="mt-6">
          <EmptyState
            title="Could not load services"
            description="Hospital search is temporarily unavailable. Please try again."
          />
        </div>
      )}

      {!failed && results === null && (
        <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {[0, 1, 2, 3, 4, 5].map((i) => (
            <Skeleton key={i} className="h-40 rounded-xl" />
          ))}
        </div>
      )}

      {!failed && results !== null && (
        <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {SERVICE_CATALOG.map((s) => {
            const info = byService.get(s.key);
            return (
              <Card key={s.key} className="transition-shadow hover:shadow-raised">
                <CardContent className="flex h-full flex-col p-5">
                  <div className="flex items-start justify-between gap-2">
                    <span className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary-50 text-primary-800">
                      <HeartPulse className="h-5 w-5" aria-hidden />
                    </span>
                    {info && info.available > 0 ? (
                      <StatusBadge status={"AVAILABLE" as Status} label={`${info.available} hospitals`} />
                    ) : (
                      <Badge variant="neutral" size="sm">Information unavailable</Badge>
                    )}
                  </div>
                  <h2 className="mt-3 text-base font-semibold text-primary-950">{s.label}</h2>
                  <p className="mt-1 flex-1 text-sm text-slate-600">
                    {info && info.hospitals > 0
                      ? `${info.available} fully available · ${info.limited} limited · ${info.hospitals} hospital${info.hospitals === 1 ? "" : "s"} report this service`
                      : "No hospital currently reports this service."}
                  </p>
                  <Link
                    href={`/dashboard/hospitals?service=${s.key}`}
                    className="mt-3 inline-flex items-center gap-1.5 text-sm font-semibold text-care-700 hover:underline"
                  >
                    Find hospitals with this service{" "}
                    <ArrowRight className="h-4 w-4" aria-hidden />
                  </Link>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
