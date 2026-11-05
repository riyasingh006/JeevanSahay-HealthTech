import Link from "next/link";
import {
  BedDouble,
  Landmark,
  Lock,
  ShieldCheck,
  Sparkles,
  Stethoscope,
} from "lucide-react";
import { FloatingSearchCard } from "./floating-search-card";
import hospitalImage from "@/components/landing/logo/eedc707e314d4a7ff029aca3ad2df245.jpg";

const TRUST_ITEMS = [
  {
    icon: ShieldCheck,
    tone: "bg-[#EAF7E8] text-[#3AAA35]",
    lines: ["Source-labelled", "Listings"],
  },
  {
    icon: BedDouble,
    tone: "bg-[#EAF3FF] text-[#2563EB]",
    lines: ["Facility-reported", "Information"],
  },
  {
    icon: Lock,
    tone: "bg-[#FFF0DF] text-[#F57C00]",
    lines: ["Secure & Private", "by Design"],
  },
  {
    icon: Landmark,
    tone: "bg-[#EAF7E8] text-[#2E9429]",
    lines: ["Care-navigation", "Tools"],
  },
];

export function Hero() {
  return (
    <section id="top" className="relative overflow-hidden bg-white">
      {/* subtle pale-blue atmosphere */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 bg-[radial-gradient(900px_420px_at_78%_18%,#EAF3FF_0%,rgba(234,243,255,0)_62%),radial-gradient(700px_380px_at_8%_100%,#F3F8FF_0%,rgba(243,248,255,0)_60%)]"
      />

      {/* ---- hospital scene layer: full hero height, right side, masked into the page (desktop) ---- */}
      <div className="pointer-events-none absolute -top-1 -bottom-2 right-0 hidden w-[62%] lg:block [-webkit-mask-image:linear-gradient(to_right,transparent_0%,rgba(0,0,0,0.2)_4%,rgba(0,0,0,0.6)_10%,rgba(0,0,0,0.92)_18%,black_26%)] [mask-image:linear-gradient(to_right,transparent_0%,rgba(0,0,0,0.2)_4%,rgba(0,0,0,0.6)_10%,rgba(0,0,0,0.92)_18%,black_26%)]">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={hospitalImage.src}
          alt="Modern multispeciality hospital building with an ambulance at the entrance"
          className="h-full w-full object-cover object-[center_45%] [filter:brightness(0.96)_saturate(1.08)_contrast(1.1)]"
        />
        {/* search card floats over the scene — re-enables pointer events for interactivity */}
        <div className="pointer-events-auto absolute right-[13%] top-[54%] z-10 -translate-y-1/2">
          <FloatingSearchCard />
        </div>
      </div>

      <div className="relative mx-auto w-full max-w-[1500px] px-4 sm:px-6 lg:px-8">
        <div className="grid items-center gap-10 pb-6 pt-6 lg:grid-cols-[39fr_61fr] lg:gap-6 lg:pb-7 lg:pt-1 [@media(max-height:840px)]:lg:pb-5 [@media(max-height:840px)]:lg:pt-0">
          {/* ---------- left content ---------- */}
          <div className="lg:pl-9">
            <span className="inline-flex h-[26px] items-center gap-1.5 rounded-full bg-[#EAF3FF] px-3 text-[11px] font-bold tracking-wide text-[#062B73] ring-1 ring-inset ring-[#D7E6FB]">
              <Sparkles className="h-3.5 w-3.5 text-[#F57C00]" aria-hidden />
              AI-POWERED HEALTHCARE NAVIGATION
            </span>

            <h1 className="mt-7 font-extrabold leading-[1.24] tracking-tight">
              <span className="block text-[34px] text-[#F57C00] sm:text-[40px] lg:text-[50px]">
                सही अस्पताल।
              </span>
              <span className="block text-[34px] text-[#061F55] sm:text-[40px] lg:text-[50px]">
                सही समय।
              </span>
              <span className="block text-[34px] text-[#3AAA35] sm:text-[40px] lg:text-[50px]">
                सही देखभाल।
              </span>
            </h1>

            <p className="mt-3 max-w-[520px] text-[15px] leading-[1.6] text-[#33415C]">
              Find hospital and specialist listings near you. Facility-reported availability can be outdated; confirm directly before travelling.
            </p>

            {/* CTAs */}
            <div className="mt-9 flex flex-wrap items-center gap-x-10 gap-y-3.5 sm:flex-row">
              <Link
                href="/login"
                className="inline-flex h-[44px] min-w-[255px] items-center justify-center gap-2 rounded-md bg-[#062B73] px-5 text-[13.5px] font-bold text-white shadow-[0_12px_24px_-10px_rgba(6,43,115,0.55)] transition-all duration-150 hover:-translate-y-0.5 hover:bg-[#0B3D91] hover:shadow-lg"
              >
                <Stethoscope className="h-4 w-4" aria-hidden />
                Find Hospitals Near You
              </Link>
              <a
                href="#features"
                className="inline-flex h-[44px] min-w-[186px] items-center justify-center gap-1.5 rounded-md border border-[#062B73]/70 bg-white px-5 text-[13.5px] font-bold text-[#062B73] transition-all duration-150 hover:-translate-y-0.5 hover:border-[#062B73] hover:shadow-md"
              >
                Explore Features →
              </a>
            </div>

            {/* trust indicators */}
            <ul className="mt-10 grid max-w-[520px] grid-cols-2 gap-x-5 gap-y-4 sm:flex sm:flex-wrap">
              {TRUST_ITEMS.map(({ icon: Icon, tone, lines }) => (
                <li key={lines[0]} className="flex items-center gap-2.5">
                  <span
                    className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full ${tone}`}
                  >
                    <Icon className="h-4 w-4" aria-hidden />
                  </span>
                  <span className="text-[11.5px] font-bold leading-[1.35] text-[#061F55]">
                    {lines[0]}
                    <br />
                    <span className="font-semibold text-[#52627A]">{lines[1]}</span>
                  </span>
                </li>
              ))}
            </ul>
          </div>

          {/* ---------- mobile / tablet visual + search card ---------- */}
          <div className="lg:hidden">
            <div className="relative mx-auto max-h-[300px] overflow-hidden sm:max-h-[340px]">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={hospitalImage.src}
                alt="Modern multispeciality hospital building with an ambulance at the entrance"
                className="h-full w-full object-cover object-[center_45%]"
              />
              <div
                aria-hidden
                className="absolute inset-x-0 top-0 h-16 bg-gradient-to-b from-white/90 to-transparent"
              />
            </div>
            <div className="mt-6 flex justify-center">
              <FloatingSearchCard />
            </div>
          </div>

          {/* desktop: spacer preserving hero height — the visual lives in the section layer behind */}
          <div
            aria-hidden
            className="hidden lg:block lg:h-[560px] [@media(max-height:840px)]:lg:h-[480px]"
          />
        </div>
      </div>
    </section>
  );
}
