import { cn } from "@/lib/utils";

/** Institutional brand emblem — shield + care cross with tricolour base. */
export function BrandMark({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 44 44"
      className={cn("h-10 w-10", className)}
      role="img"
      aria-label="जीवन Sahay emblem"
    >
      <path
        d="M22 3 L37 8.5 V21 C37 30.5 30.6 37.9 22 41 C13.4 37.9 7 30.5 7 21 V8.5 Z"
        fill="#0E2342"
      />
      <path
        d="M22 6.2 L34 10.7 V21 C34 28.9 28.8 35.1 22 37.9 C15.2 35.1 10 28.9 10 21 V10.7 Z"
        fill="none"
        stroke="#B8CDEA"
        strokeWidth="1"
        opacity="0.55"
      />
      <rect x="19.4" y="12.5" width="5.2" height="16" rx="1.4" fill="#FFFFFF" />
      <rect x="14" y="17.9" width="16" height="5.2" rx="1.4" fill="#FFFFFF" />
      <rect x="11" y="31.5" width="22" height="1.6" rx="0.8" fill="#EA7A12" />
      <rect x="11" y="33.9" width="22" height="1.6" rx="0.8" fill="#FFFFFF" opacity="0.85" />
      <rect x="11" y="36.3" width="22" height="1.6" rx="0.8" fill="#12813B" />
    </svg>
  );
}

export function BrandLockup({
  compact = false,
  light = false,
}: {
  compact?: boolean;
  light?: boolean;
}) {
  return (
    <span className="flex items-center gap-2.5">
      <BrandMark className={compact ? "h-8 w-8" : "h-10 w-10"} />
      <span className="flex flex-col leading-none">
        <span
          className={cn(
            "font-semibold tracking-tight",
            compact ? "text-lg" : "text-xl",
            light ? "text-white" : "text-primary-900"
          )}
        >
          <span className="font-devanagari">जीवन</span>{" "}
          <span className={light ? "text-saffron-300" : "text-saffron-600"}>
            Sahay
          </span>
        </span>
        {!compact && (
          <span
            className={cn(
              "mt-1 hidden text-[10px] font-medium uppercase tracking-[0.14em] sm:block",
              light ? "text-primary-100/80" : "text-slate-500"
            )}
          >
            AI-Powered Healthcare Navigation Platform
          </span>
        )}
      </span>
    </span>
  );
}
