import { BedDouble, Building2, Siren, Stethoscope } from "lucide-react";
import { Reveal } from "./reveal";

const STATS = [
  { icon: Building2, tone: "bg-[#3AAA35]", value: "Search", label: "Hospital listings" },
  { icon: BedDouble, tone: "bg-[#2563EB]", value: "Check", label: "Reported information" },
  { icon: Stethoscope, tone: "bg-[#7C6BD6]", value: "Browse", label: "Doctor listings" },
  { icon: Siren, tone: "bg-[#F57C00]", value: "112", label: "Emergency helpline" },
];

export function StatsBar() {
  return (
    <section aria-label="Available services" className="relative z-10 pb-2">
      <div className="mx-auto w-full max-w-[1500px] px-4 sm:px-6 lg:px-8">
        <Reveal>
          <div className="grid grid-cols-2 gap-y-5 rounded-[14px] bg-[#062B73] px-6 py-5 shadow-[0_20px_44px_-18px_rgba(6,31,85,0.55)] sm:py-6 lg:h-24 lg:grid-cols-4 lg:items-center lg:gap-4 lg:px-10 lg:py-0">
            {STATS.map(({ icon: Icon, tone, value, label }) => (
              <div key={label} className="flex items-center justify-center gap-3.5">
                <span
                  className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-full ${tone} ring-4 ring-white/10`}
                >
                  <Icon className="h-5 w-5 text-white" aria-hidden />
                </span>
                <span className="leading-tight">
                  <span className="block text-[19px] font-bold tabular-nums text-white lg:text-xl">
                    {value}
                  </span>
                  <span className="block text-[12px] font-medium text-white/85">
                    {label}
                  </span>
                </span>
              </div>
            ))}
          </div>
        </Reveal>
      </div>
    </section>
  );
}
