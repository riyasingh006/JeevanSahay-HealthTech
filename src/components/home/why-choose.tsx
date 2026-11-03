import Link from "next/link";
import {
  ArrowRight,
  BedDouble,
  BrainCircuit,
  CheckCircle2,
  Cross,
  FileHeart,
  Hospital,
  MapPin,
  ShieldCheck,
  Siren,
  Stethoscope,
} from "lucide-react";
import { Reveal } from "./reveal";

export function SectionTitle({ children }: { children: React.ReactNode }) {
  return (
    <div className="text-center">
      <h2 className="text-[21px] font-bold text-[#061F55] sm:text-[22px]">
        {children}
      </h2>
      <span aria-hidden className="mt-2.5 inline-flex h-[3px] overflow-hidden rounded-full">
        <span className="h-full w-[22px] bg-[#F57C00]" />
        <span className="h-full w-[23px] bg-[#3AAA35]" />
      </span>
    </div>
  );
}

type Feature = {
  icon: React.ComponentType<{ className?: string; "aria-hidden"?: boolean | "true" | "false" }>;
  title: string;
  desc: string;
  points: string[];
  href?: string;
  tone: string;
  chipTone: string;
  badge?: string;
  note?: string;
};

const FEATURES: Feature[] = [
  {
    icon: Hospital,
    title: "Smart Hospital Search",
    desc: "Find the most suitable hospitals based on your condition, location, and availability.",
    points: [
      "Search by disease or specialty",
      "Filter by location, distance & ratings",
      "Government & private hospitals",
      "Detailed hospital information",
    ],
    href: "/hospitals",
    tone: "bg-[#E8F0FC] text-[#1557B0] group-hover:bg-[#D7E6FA]",
    chipTone: "",
  },
  {
    icon: BedDouble,
    title: "Reported Bed Information",
    desc: "Review bed counts entered by facilities. These records can change and are not a live capacity feed.",
    points: [
      "Reported bed categories",
      "Last-recorded update time",
      "Confirm capacity by phone",
      "Demo records are labelled",
    ],
    href: "/hospitals",
    tone: "bg-[#E6F4EF] text-[#138A4B] group-hover:bg-[#D5EDDF]",
    chipTone: "",
  },
  {
    icon: Stethoscope,
    title: "Find Specialists",
    desc: "Browse specialist profiles listed by facilities; schedules and credentials are not independently confirmed here.",
    points: [
      "Search by specialty",
      "Profiles and experience where provided",
      "Timings are not appointment confirmation",
      "Confirm details with the facility",
    ],
    href: "/hospitals",
    tone: "bg-[#EDE9FB] text-[#6D4FD0] group-hover:bg-[#E1DBF7]",
    chipTone: "",
  },
  {
    icon: Siren,
    title: "Emergency Guidance",
    desc: "Find hospital listings and call the official helpline. Jeevan Sahay does not dispatch ambulances or confirm emergency capacity.",
    points: [
      "Call 112 for emergencies",
      "Call 108 for ambulance service",
      "Facility capacity is not confirmed",
      "Use directions only after confirming",
    ],
    href: "/dashboard/emergency",
    tone: "bg-[#FDEEE6] text-[#E2620F] group-hover:bg-[#FBE2D3]",
    chipTone: "For life-threatening emergencies, call 112 now.",
  },
  {
    icon: BrainCircuit,
    title: "AI Health Navigator",
    desc: "Describe your symptoms and receive AI-powered healthcare navigation guidance.",
    points: [
      "Symptom understanding",
      "AI-powered recommendations",
      "Suggested care options",
      "Clear medical disclaimer",
    ],
    href: "/ai-assistant",
    tone: "bg-[#E8F0FC] text-[#1557B0] group-hover:bg-[#D7E6FA]",
    chipTone: "Guidance only — not a medical diagnosis.",
  },
  {
    icon: MapPin,
    title: "Nearby Healthcare",
    desc: "Find healthcare facilities near your current location.",
    points: [
      "Location-based hospital search",
      "Map & list view",
      "Distance & navigation",
      "Traffic-aware directions",
    ],
    href: "/hospitals",
    tone: "bg-[#E6F4F6] text-[#0E7C8C] group-hover:bg-[#D5EDF0]",
    chipTone: "",
  },
  {
    icon: ShieldCheck,
    title: "Source-labelled Listings",
    desc: "See whether a listing comes from Google Places or facility-entered records, and check what the platform has actually verified.",
    points: [
      "Platform review applies to approved facility accounts",
      "Google Places results are a separate source",
      "Capacity and availability are facility-reported",
      "Demo records are clearly labelled",
    ],
    href: "/hospitals",
    tone: "bg-[#E6F4EF] text-[#138A4B] group-hover:bg-[#D5EDDF]",
    chipTone: "Verify important details directly with the facility.",
  },
  {
    icon: FileHeart,
    title: "Health Records",
    desc: "Securely manage important health information in one place.",
    points: [
      "Medical history",
      "Reports & prescriptions",
      "Secure cloud backup",
      "Share with healthcare providers",
    ],
    tone: "bg-[#F0F3F8] text-[#5B6B7A] group-hover:bg-[#E5EBF3]",
    chipTone: "",
    badge: "COMING SOON",
  },
];

function TricolorRule() {
  return (
    <span aria-hidden className="mt-4 inline-flex items-center gap-1.5">
      <span className="h-[3px] w-7 rounded-full bg-[#F28C28]" />
      <span className="h-[3px] w-7 rounded-full bg-white ring-1 ring-inset ring-[#DCE5EF]" />
      <span className="h-[3px] w-7 rounded-full bg-[#138A4B]" />
    </span>
  );
}

function SubtleIllustration() {
  return (
    <svg
      aria-hidden
      viewBox="0 0 720 220"
      className="pointer-events-none absolute inset-x-0 bottom-0 mx-auto h-full w-full max-w-[1100px] opacity-[0.05]"
      fill="none"
    >
      <Hospital x={60} y={60} width={120} height={120} />
      <path d="M40 170h180M300 150c30-24 66-34 104-30m-20 52c28 6 58-2 78-20" stroke="#063B82" strokeWidth="10" strokeLinecap="round" />
      <rect x={430} y={90} width={90} height={70} rx={10} stroke="#063B82" strokeWidth={8} />
      <path d="M455 125h40M475 105v40" stroke="#063B82" strokeWidth={8} strokeLinecap="round" />
      <path d="M600 60a34 34 0 0 1 34 34c0 24-34 56-34 56s-34-32-34-56a34 34 0 0 1 34-34Z" stroke="#063B82" strokeWidth={8} />
      <circle cx={600} cy={94} r={12} fill="#063B82" />
      <path d="M40 30h24v24h24V30h24v24h-24v24h64" stroke="#138A4B" strokeWidth={8} strokeLinecap="round" />
    </svg>
  );
}

export function WhyChoose() {
  return (
    <section id="features" className="scroll-mt-28 bg-white">
      {/* section header */}
      <div className="relative overflow-hidden bg-[#F5F8FC] pb-9 pt-11 lg:pb-11 lg:pt-12">
        <SubtleIllustration />
        <div className="relative mx-auto w-full max-w-[1400px] px-4 text-center sm:px-6 lg:px-8">
          <Reveal>
            <span className="inline-flex h-[26px] items-center gap-1.5 rounded-full bg-[#E8F0FC] px-3.5 text-[11px] font-bold tracking-[0.12em] text-[#1557B0] ring-1 ring-inset ring-[#C9DCF6]">
              <Cross className="h-3 w-3 text-[#F28C28]" aria-hidden />
              OUR FEATURES
            </span>
            <h2 className="mx-auto mt-4 max-w-3xl text-balance text-[24px] font-extrabold leading-[1.22] tracking-tight text-[#102A43] sm:text-[30px] lg:text-[34px]">
              Powerful Features Built for
              <br />
              Smarter <span className="text-[#1557B0]">Healthcare Navigation</span>
            </h2>
            <p className="mx-auto mt-3.5 max-w-2xl text-balance text-[13.5px] leading-[1.7] text-[#5B6B7A] lg:text-[15px]">
              Jeevan Sahay combines AI technology with verified healthcare information to help you
              find the right care, at the right time, in the right place.
            </p>
            <TricolorRule />
          </Reveal>
        </div>
      </div>

      {/* premium feature grid */}
      <div className="bg-white py-9 lg:py-11">
        <div className="mx-auto w-full max-w-[1400px] px-4 sm:px-6 lg:px-8">
          <ul className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-4">
            {FEATURES.map((f, i) => {
              const Icon = f.icon;
              const inner = (
                <>
                  {f.badge ? (
                    <span className="absolute right-4 top-4 rounded-full bg-[#FFF4E8] px-2.5 py-1 text-[9.5px] font-bold tracking-[0.08em] text-[#C05F00] ring-1 ring-inset ring-[#F5D8B8]">
                      {f.badge}
                    </span>
                  ) : null}
                  <span
                    className={`flex h-12 w-12 items-center justify-center rounded-full transition-colors duration-200 ${f.tone}`}
                  >
                    <Icon className="h-[22px] w-[22px]" aria-hidden />
                  </span>
                  <h3 className="mt-4 text-[15px] font-bold leading-snug text-[#102A43]">
                    {f.title}
                  </h3>
                  <p className="mt-1.5 text-[12.5px] leading-[1.6] text-[#5B6B7A]">{f.desc}</p>
                  <ul className="mt-3.5 space-y-1.5">
                    {f.points.map((p) => (
                      <li key={p} className="flex items-start gap-2 text-[12px] leading-[1.5] text-[#33465C]">
                        <CheckCircle2 className="mt-px h-3.5 w-3.5 shrink-0 text-[#138A4B]" aria-hidden />
                        {p}
                      </li>
                    ))}
                  </ul>
                  {f.chipTone ? (
                    <p className="mt-3 rounded-md bg-[#F5F8FC] px-2.5 py-1.5 text-[10.5px] font-medium leading-snug text-[#5B6B7A] ring-1 ring-inset ring-[#DCE5EF]">
                      {f.chipTone}
                    </p>
                  ) : null}
                  {f.href ? (
                    <span className="mt-auto inline-flex items-center gap-1 pt-4 text-[12.5px] font-bold text-[#1557B0] transition-all duration-200 group-hover:gap-2 motion-reduce:transition-none">
                      Learn More <ArrowRight className="h-3.5 w-3.5" aria-hidden />
                    </span>
                  ) : (
                    <span className="mt-auto inline-flex cursor-not-allowed items-center gap-1 pt-4 text-[12.5px] font-bold text-[#93A3B5]">
                      Coming Soon
                    </span>
                  )}
                </>
              );
              const cardCls =
                "group relative flex h-full flex-col rounded-2xl border border-[#DCE5EF] bg-white p-5 text-left shadow-[0_6px_18px_-12px_rgba(16,42,67,0.25)] transition-all duration-200 hover:-translate-y-1 hover:border-[#BFD2EA] hover:shadow-[0_16px_30px_-16px_rgba(16,42,67,0.35)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#1557B0] motion-reduce:transition-none motion-reduce:hover:translate-y-0";
              return (
                <li key={f.title}>
                  <Reveal delay={(i % 4) * 60} className="h-full">
                    {f.href ? (
                      <Link href={f.href} className={cardCls}>
                        {inner}
                      </Link>
                    ) : (
                      <div className={`${cardCls} border-dashed`} aria-label={`${f.title} — coming soon`}>
                        {inner}
                      </div>
                    )}
                  </Reveal>
                </li>
              );
            })}
          </ul>
        </div>
      </div>

      {/* premium CTA */}
      <div className="bg-white pb-4">
        <div className="mx-auto w-full max-w-[1400px] px-4 sm:px-6 lg:px-8">
          <Reveal>
            <div className="relative overflow-hidden rounded-2xl bg-[#062B5F] px-6 py-10 text-center sm:px-10 lg:py-12">
              <svg
                aria-hidden
                viewBox="0 0 400 160"
                className="pointer-events-none absolute -left-8 top-1/2 hidden h-[130%] -translate-y-1/2 text-white/[0.05] lg:block"
                fill="none"
              >
                <Cross className="h-24 w-24" />
              </svg>
              <span
                aria-hidden
                className="absolute left-1/2 top-0 h-[3px] w-40 -translate-x-1/2 rounded-b-full bg-gradient-to-r from-[#F28C28] via-white to-[#138A4B]"
              />
              <h3 className="font-devanagari relative text-[21px] font-extrabold tracking-tight text-white lg:text-[25px]">
                अब सही इलाज ढूँढना हुआ आसान
              </h3>
              <p className="relative mx-auto mt-2.5 max-w-lg text-[13px] leading-[1.65] text-white/75 lg:text-[14px]">
                Join Jeevan Sahay and simplify your healthcare navigation journey.
              </p>
              <div className="relative mt-7 flex flex-col items-center justify-center gap-3 sm:flex-row">
                <Link
                  href="/hospitals"
                  className="inline-flex h-[44px] min-w-[190px] items-center justify-center gap-2 rounded-lg bg-[#138A4B] px-6 text-[13.5px] font-bold text-white shadow-[0_10px_24px_-10px_rgba(19,138,75,0.7)] transition-all duration-150 hover:-translate-y-0.5 hover:bg-[#0F7A41] hover:shadow-lg focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white motion-reduce:transition-none motion-reduce:hover:translate-y-0"
                >
                  Explore Features <ArrowRight className="h-4 w-4" aria-hidden />
                </Link>
                <Link
                  href="/signup"
                  className="inline-flex h-[44px] min-w-[190px] items-center justify-center rounded-lg border border-white/60 bg-white px-6 text-[13.5px] font-bold text-[#062B5F] transition-all duration-150 hover:-translate-y-0.5 hover:bg-[#F5F8FC] hover:shadow-lg focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white motion-reduce:transition-none motion-reduce:hover:translate-y-0"
                >
                  Create Your Account
                </Link>
              </div>
            </div>
          </Reveal>
        </div>
      </div>
    </section>
  );
}
