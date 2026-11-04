import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { AlertTriangle, Clock } from "lucide-react";
import { cn, timeAgo } from "@/lib/utils";
import { FRESHNESS_MS } from "@/lib/constants";

const badgeVariants = cva(
  "inline-flex items-center gap-1 rounded-full border font-medium",
  {
    variants: {
      variant: {
        neutral: "border-slate-200 bg-slate-50 text-slate-600",
        primary: "border-primary-200 bg-primary-50 text-primary-700",
        saffron: "border-saffron-200 bg-saffron-50 text-saffron-700",
        green: "border-india-200 bg-india-50 text-india-600",
        red: "border-red-200 bg-red-50 text-red-700",
        outline: "border-slate-300 bg-transparent text-slate-600",
      },
      size: {
        sm: "px-2 py-0.5 text-[11px]",
        md: "px-2.5 py-1 text-xs",
      },
    },
    defaultVariants: { variant: "neutral", size: "sm" },
  }
);

export interface BadgeProps
  extends React.HTMLAttributes<HTMLSpanElement>,
    VariantProps<typeof badgeVariants> {}

export function Badge({ className, variant, size, ...props }: BadgeProps) {
  return <span className={cn(badgeVariants({ variant, size }), className)} {...props} />;
}

/* ---------- Availability status pill ---------- */

const STATUS_STYLES: Record<string, string> = {
  AVAILABLE:
    "border-status-available-border bg-status-available-bg text-status-available-fg",
  LIMITED: "border-status-limited-border bg-status-limited-bg text-status-limited-fg",
  UNAVAILABLE:
    "border-status-unavailable-border bg-status-unavailable-bg text-status-unavailable-fg",
};

export function StatusBadge({
  status,
  label,
  className,
}: {
  status: string;
  label?: string;
  className?: string;
}) {
  const s = (status ?? "").toUpperCase();
  const style =
    STATUS_STYLES[s] ??
    "border-status-info-border bg-status-info-bg text-status-info-fg";
  const dotColor =
    s === "AVAILABLE"
      ? "bg-india-500"
      : s === "LIMITED"
        ? "bg-amber-500"
        : s === "UNAVAILABLE"
          ? "bg-red-500"
          : "bg-care-500";
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-[11px] font-semibold uppercase tracking-wide",
        style,
        className
      )}
    >
      <span
        className={cn("h-1.5 w-1.5 rounded-full", dotColor)}
        aria-hidden
      />
      {label ?? s.replace("_", " ")}
    </span>
  );
}

/** "Updated X ago" with staleness warning beyond the freshness window. */
export function LastUpdated({
  at,
  className,
  prefix = "Updated",
}: {
  at: Date | string | null | undefined;
  className?: string;
  prefix?: string;
}) {
  const stale = at ? Date.now() - new Date(at).getTime() > FRESHNESS_MS : true;
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 text-xs",
        stale ? "text-red-700" : "text-slate-500",
        className
      )}
    >
      {stale ? (
        <>
          <AlertTriangle className="h-3.5 w-3.5" aria-hidden />
          Information may be outdated
        </>
      ) : (
        <>
          <Clock className="h-3.5 w-3.5" aria-hidden />
          {prefix} {timeAgo(at)}
        </>
      )}
    </span>
  );
}

export { badgeVariants };
