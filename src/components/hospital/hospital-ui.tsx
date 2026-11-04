"use client";

import * as React from "react";
import {
  Activity,
  ArrowDownRight,
  ArrowUpRight,
  Info,
  type LucideIcon,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import type { DailyTrendPoint } from "@/lib/hospital/hospital-data";
import { useHospitalPortal } from "@/components/hospital/hospital-store";

export const selectClass =
  "flex h-10 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-ink shadow-sm transition-colors focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-500/20 disabled:cursor-not-allowed disabled:bg-slate-50";

export function NativeSelect({
  className,
  ...props
}: React.SelectHTMLAttributes<HTMLSelectElement>) {
  return <select className={cn(selectClass, className)} {...props} />;
}

export function HospitalDataBadge({ className }: { className?: string }) {
  const { loading, error, settings } = useHospitalPortal();
  if (!settings.display.showLiveBadges) return null;
  const label = loading ? "Connecting" : error ? "Data unavailable" : "Hospital records";
  const tone = error ? "border-rose-200 bg-rose-50 text-rose-700" : loading ? "border-slate-200 bg-slate-50 text-slate-600" : "border-emerald-200 bg-emerald-50 text-emerald-700";
  return (
    <span className={cn("inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] font-semibold uppercase tracking-wide", tone, className)}>
      <Info className="h-3 w-3" aria-hidden />
      {label}
    </span>
  );
}

export function todayHospitalLabel(): string {
  return new Date().toLocaleDateString("en-IN", {
    timeZone: "Asia/Kolkata",
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}

export function PageHeader({
  title,
  description,
  actions,
  eyebrow,
  icon: Icon,
}: {
  title: string;
  description?: string;
  actions?: React.ReactNode;
  eyebrow?: string;
  icon?: LucideIcon;
}) {
  return (
    <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
      <div className="min-w-0">
        {eyebrow && (
          <p className="mb-1 text-[11px] font-semibold uppercase tracking-[0.14em] text-care-700">
            {eyebrow}
          </p>
        )}
        <div className="flex items-center gap-2.5">
          {Icon && (
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary-50 text-primary-700">
              <Icon className="h-5 w-5" aria-hidden />
            </span>
          )}
          <h1 className="institutional-heading text-2xl">{title}</h1>
          <HospitalDataBadge className="hidden sm:inline-flex" />
        </div>
        {description && (
          <p className="mt-1.5 max-w-3xl text-sm leading-relaxed text-slate-600">
            {description}
          </p>
        )}
      </div>
      {actions && (
        <div className="flex shrink-0 flex-wrap items-center gap-2 print:hidden">
          {actions}
        </div>
      )}
    </div>
  );
}

const STAT_TONES = {
  blue: "bg-primary-50 text-primary-700",
  teal: "bg-care-50 text-care-700",
  green: "bg-india-50 text-india-600",
  amber: "bg-saffron-50 text-saffron-700",
  red: "bg-red-50 text-red-700",
  violet: "bg-violet-50 text-violet-700",
} as const;

export type StatTone = keyof typeof STAT_TONES;

export function StatCard({
  label,
  value,
  hint,
  icon: Icon,
  tone = "blue",
  trend,
}: {
  label: string;
  value: React.ReactNode;
  hint?: string;
  icon: LucideIcon;
  tone?: StatTone;
  trend?: { value: string; direction: "up" | "down"; positive?: boolean };
}) {
  return (
    <Card className="overflow-hidden shadow-card transition-shadow hover:shadow-raised">
      <CardContent className="flex items-start gap-3.5 p-4">
        <span
          className={cn(
            "flex h-10 w-10 shrink-0 items-center justify-center rounded-xl",
            STAT_TONES[tone]
          )}
        >
          <Icon className="h-5 w-5" aria-hidden />
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">
            {label}
          </p>
          <p className="mt-0.5 text-2xl font-bold leading-tight tabular-nums text-primary-950">
            {value}
          </p>
          <div className="mt-0.5 flex flex-wrap items-center gap-1.5">
            {hint && <p className="text-[11px] leading-tight text-slate-500">{hint}</p>}
            {trend && (
              <span
                className={cn(
                  "inline-flex items-center gap-0.5 text-[10.5px] font-semibold",
                  trend.positive === false ? "text-red-600" : "text-india-600"
                )}
              >
                {trend.direction === "up" ? (
                  <ArrowUpRight className="h-3 w-3" aria-hidden />
                ) : (
                  <ArrowDownRight className="h-3 w-3" aria-hidden />
                )}
                {trend.value}
              </span>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

const STATUS_STYLES: Record<
  string,
  { variant: "neutral" | "primary" | "saffron" | "green" | "red" | "outline"; label: string }
> = {
  AVAILABLE: { variant: "green", label: "Available" },
  OCCUPIED: { variant: "primary", label: "Occupied" },
  RESERVED: { variant: "saffron", label: "Reserved" },
  MAINTENANCE: { variant: "neutral", label: "Maintenance" },
  ACTIVE: { variant: "green", label: "Active" },
  LIMITED: { variant: "saffron", label: "Limited" },
  INACTIVE: { variant: "neutral", label: "Inactive" },
  CRITICAL: { variant: "red", label: "Critical" },
  URGENT: { variant: "saffron", label: "Urgent" },
  MODERATE: { variant: "primary", label: "Moderate" },
  RECEIVED: { variant: "primary", label: "Received" },
  IN_TREATMENT: { variant: "saffron", label: "In treatment" },
  STABILIZED: { variant: "green", label: "Stabilized" },
  DISCHARGED: { variant: "neutral", label: "Discharged" },
  REQUESTED: { variant: "saffron", label: "Requested" },
  CONFIRMED: { variant: "primary", label: "Confirmed" },
  DECLINED: { variant: "red", label: "Declined" },
  COMPLETED: { variant: "green", label: "Completed" },
  CANCELLED: { variant: "red", label: "Cancelled" },
  NO_SHOW: { variant: "neutral", label: "No show" },
  UNAVAILABLE: { variant: "neutral", label: "Unavailable" },
};

export function HospitalStatusBadge({
  status,
  className,
  size = "md",
}: {
  status: string;
  className?: string;
  size?: "sm" | "md";
}) {
  const key = status.toUpperCase();
  const config = STATUS_STYLES[key] ?? {
    variant: "outline" as const,
    label: key.replace(/_/g, " "),
  };
  return (
    <Badge variant={config.variant} size={size} className={className}>
      <span
        className={cn(
          "h-1.5 w-1.5 rounded-full",
          config.variant === "green" && "bg-india-500",
          config.variant === "saffron" && "bg-saffron-500",
          config.variant === "red" && "bg-red-500",
          config.variant === "primary" && "bg-primary-600",
          config.variant === "neutral" && "bg-slate-400"
        )}
        aria-hidden
      />
      {config.label}
    </Badge>
  );
}

export function ProgressBar({
  value,
  tone = "blue",
  className,
  label,
}: {
  value: number;
  tone?: "blue" | "teal" | "green" | "amber" | "red" | "violet";
  className?: string;
  label?: string;
}) {
  const safe = Math.max(0, Math.min(100, Math.round(value)));
  const toneClass = {
    blue: "bg-primary-600",
    teal: "bg-care-500",
    green: "bg-india-500",
    amber: "bg-saffron-500",
    red: "bg-red-600",
    violet: "bg-violet-500",
  }[tone];
  return (
    <div
      className={cn("h-2 w-full overflow-hidden rounded-full bg-slate-100", className)}
      role="progressbar"
      aria-valuenow={safe}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-label={label}
    >
      <div
        className={cn("h-full rounded-full transition-all duration-500", toneClass)}
        style={{ width: `${safe}%` }}
      />
    </div>
  );
}

export function OccupancyDonut({
  occupied,
  total,
  label = "Bed occupancy",
  size = 168,
}: {
  occupied: number;
  total: number;
  label?: string;
  size?: number;
}) {
  const percent = total ? Math.round((occupied / total) * 100) : 0;
  return (
    <div
      className="relative flex shrink-0 items-center justify-center rounded-full"
      style={{
        width: size,
        height: size,
        background: `conic-gradient(#1d4a8c 0deg ${percent * 3.6}deg, #e8eef7 ${percent * 3.6}deg 360deg)`,
      }}
      role="img"
      aria-label={`${label}: ${percent}% (${occupied} of ${total} beds occupied)`}
    >
      <div
        className="flex flex-col items-center justify-center rounded-full bg-white shadow-inner"
        style={{ width: size - 34, height: size - 34 }}
      >
        <span className="text-3xl font-bold tabular-nums text-primary-950">
          {percent}%
        </span>
        <span className="mt-0.5 max-w-24 text-center text-[10.5px] font-semibold uppercase tracking-wide text-slate-500">
          {label}
        </span>
      </div>
    </div>
  );
}

export function LegendDot({
  color,
  label,
  value,
}: {
  color: string;
  label: string;
  value?: React.ReactNode;
}) {
  return (
    <div className="flex items-center justify-between gap-3 text-xs">
      <span className="flex items-center gap-2 text-slate-600">
        <span className={cn("h-2.5 w-2.5 rounded-full", color)} aria-hidden />
        {label}
      </span>
      {value !== undefined && (
        <span className="font-semibold tabular-nums text-primary-900">{value}</span>
      )}
    </div>
  );
}

const SERIES_COLORS = ["#1d4a8c", "#0f9fa8", "#ea7a12", "#9b59b6", "#12813b"];

export function TrendChart({
  data,
  series,
  height = 200,
  emptyLabel = "No trend data available.",
}: {
  data: DailyTrendPoint[];
  series: { key: keyof Omit<DailyTrendPoint, "date">; label: string }[];
  height?: number;
  emptyLabel?: string;
}) {
  const gradientId = React.useId().replace(/:/g, "");
  if (data.length === 0) {
    return (
      <div className="flex h-40 items-center justify-center rounded-lg border border-dashed border-slate-300 bg-slate-50/60 text-sm text-slate-500">
        {emptyLabel}
      </div>
    );
  }

  const width = 720;
  const paddingX = 34;
  const paddingY = 22;
  const innerW = width - paddingX * 2;
  const innerH = height - paddingY * 2;
  const max = Math.max(
    1,
    ...data.flatMap((point) => series.map((entry) => point[entry.key]))
  );
  const stepX = data.length > 1 ? innerW / (data.length - 1) : innerW;

  const pointsFor = (key: keyof Omit<DailyTrendPoint, "date">) =>
    data
      .map((point, index) => {
        const x = paddingX + index * stepX;
        const y = paddingY + innerH - (point[key] / max) * innerH;
        return `${x.toFixed(1)},${y.toFixed(1)}`;
      })
      .join(" ");

  const labelIndexes = new Set<number>();
  const labelStep = Math.max(1, Math.ceil(data.length / 7));
  data.forEach((_, index) => {
    if (index % labelStep === 0 || index === data.length - 1) {
      labelIndexes.add(index);
    }
  });

  return (
    <div>
      <svg
        viewBox={`0 0 ${width} ${height}`}
        className="h-auto w-full"
        role="img"
        aria-label={`Trend chart: ${series.map((entry) => entry.label).join(", ")}`}
      >
        <defs>
          <linearGradient id={`trend-${gradientId}`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={SERIES_COLORS[0]} stopOpacity="0.18" />
            <stop offset="100%" stopColor={SERIES_COLORS[0]} stopOpacity="0" />
          </linearGradient>
        </defs>
        {[0, 0.25, 0.5, 0.75, 1].map((ratio) => {
          const y = paddingY + innerH - ratio * innerH;
          return (
            <g key={ratio}>
              <line
                x1={paddingX}
                x2={width - paddingX}
                y1={y}
                y2={y}
                stroke="#e2e8f0"
                strokeWidth="1"
              />
              <text
                x={paddingX - 8}
                y={y + 3}
                textAnchor="end"
                className="fill-slate-400 text-[10px]"
              >
                {Math.round(max * ratio)}
              </text>
            </g>
          );
        })}
        {series[0] &&
          (() => {
            const first = data
              .map((point, index) => {
                const x = paddingX + index * stepX;
                const y = paddingY + innerH - (point[series[0].key] / max) * innerH;
                return `${x.toFixed(1)},${y.toFixed(1)}`;
              })
              .join(" ");
            return (
              <polygon
                points={`${paddingX},${paddingY + innerH} ${first} ${
                  paddingX + (data.length - 1) * stepX
                },${paddingY + innerH}`}
                fill={`url(#trend-${gradientId})`}
                aria-hidden
              />
            );
          })()}
        {series.map((entry, index) => (
          <polyline
            key={entry.key}
            points={pointsFor(entry.key)}
            fill="none"
            stroke={SERIES_COLORS[index % SERIES_COLORS.length]}
            strokeWidth="2.25"
            strokeLinecap="round"
            strokeLinejoin="round"
            vectorEffect="non-scaling-stroke"
          />
        ))}
        {data.map((point, index) => {
          if (!labelIndexes.has(index)) return null;
          const x = paddingX + index * stepX;
          return (
            <text
              key={point.date}
              x={x}
              y={height - 5}
              textAnchor="middle"
              className="fill-slate-400 text-[10px]"
            >
              {point.date.slice(5).replace("-", "/")}
            </text>
          );
        })}
      </svg>
      <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1.5">
        {series.map((entry, index) => (
          <span key={entry.key} className="inline-flex items-center gap-1.5 text-xs text-slate-600">
            <span
              className="h-2 w-2.5 rounded-sm"
              style={{
                backgroundColor: SERIES_COLORS[index % SERIES_COLORS.length],
              }}
              aria-hidden
            />
            {entry.label}
          </span>
        ))}
      </div>
    </div>
  );
}

export function SectionCard({
  title,
  description,
  actions,
  children,
  className,
  contentClassName,
}: {
  title: string;
  description?: string;
  actions?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
  contentClassName?: string;
}) {
  return (
    <Card className={cn("shadow-card", className)}>
      <div className="flex flex-wrap items-start justify-between gap-2 border-b border-slate-100 px-5 py-4">
        <div>
          <h2 className="flex items-center gap-2 text-sm font-bold text-primary-950">
            <Activity className="h-4 w-4 text-care-600" aria-hidden />
            {title}
          </h2>
          {description && (
            <p className="mt-1 text-xs leading-relaxed text-slate-500">
              {description}
            </p>
          )}
        </div>
        {actions}
      </div>
      <div className={cn("p-5", contentClassName)}>{children}</div>
    </Card>
  );
}

export function LiveRecordsNotice({ children }: { children?: React.ReactNode }) {
  return (
    <p className="flex items-start gap-2 rounded-lg border border-care-200 bg-care-50 px-3.5 py-2.5 text-xs leading-relaxed text-care-700">
      <Info className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden />
      <span>
        This page reads and updates records for your verified hospital. These records are not synchronised with an external hospital information system.
        {children ? <span className="ml-1">{children}</span> : null}
      </span>
    </p>
  );
}
