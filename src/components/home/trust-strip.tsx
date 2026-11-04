import Link from "next/link";
import { Accessibility, FileCheck2, PhoneCall, ShieldCheck, BadgeCheck } from "lucide-react";

const TRUST_ICONS = [
  { icon: ShieldCheck, label: "Secure" },
  { icon: FileCheck2, label: "Transparent" },
  { icon: Accessibility, label: "Accessible" },
  { icon: BadgeCheck, label: "Source-labelled" },
];

export function TrustStrip() {
  return (
    <footer id="about" className="scroll-mt-28 border-t border-[#EEF2F8] bg-[#FAFBFD]">
      <div className="mx-auto grid w-full max-w-[1500px] gap-10 px-4 py-12 sm:px-6 lg:grid-cols-3 lg:items-center lg:gap-6 lg:px-8">
        {/* left â€” initiative */}
        <div>
          <div className="flex items-center gap-3">
            <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-[#0B3D91] to-[#062B73] shadow-md">
              <svg viewBox="0 0 24 24" className="h-[22px] w-[22px]" fill="none" aria-hidden>
                <path
                  d="M4 13.5h3l1.7-3.4 2.6 6.3 2.2-4.9 1.3 2h5.2"
                  stroke="#fff"
                  strokeWidth="1.9"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
            </span>
            <div className="leading-tight">
              <p className="text-[15px] font-extrabold tracking-tight">
                <span className="font-devanagari text-[#FF6A00]">जीवन</span>{" "}
                <span className="text-[#0B3D91]">Sahay</span>
              </p>
              <p className="mt-0.5 text-[11px] font-semibold uppercase tracking-wider text-[#7B8BA5]">
                Healthcare for All Initiative
              </p>
            </div>
          </div>
          <p className="mt-3 max-w-xs text-[12px] leading-[1.6] text-[#52627A]">
            Find hospital listings, review facility-reported information, and use AI-assisted navigation with clear limits.
          </p>
          <nav aria-label="Footer" className="mt-4 flex flex-wrap gap-x-5 gap-y-1.5 text-[12px] font-semibold text-[#33415C]">
            <Link href="/hospitals" className="hover:text-[#062B73] hover:underline">Find Hospitals</Link>
            <Link href="/ai-assistant" className="hover:text-[#062B73] hover:underline">AI Navigator</Link>
            <Link href="/login" className="hover:text-[#062B73] hover:underline">Sign In</Link>
            <a href="tel:112" className="text-[#E24A5B] hover:underline">Emergency 112</a>
          </nav>
        </div>

        {/* center â€” trust icons */}
        <ul
          aria-label="Our commitments"
          className="grid grid-cols-2 gap-x-6 gap-y-4 self-start lg:flex lg:items-center lg:justify-center lg:gap-7"
        >
          {TRUST_ICONS.map(({ icon: Icon, label }) => (
            <li key={label} className="flex flex-col items-center gap-2 text-center">
              <span className="flex h-11 w-11 items-center justify-center rounded-full border border-[#DCE6F4] bg-white text-[#0B3D91] shadow-sm">
                <Icon className="h-5 w-5" aria-hidden />
              </span>
              <span className="text-[12px] font-bold text-[#33415C]">{label}</span>
            </li>
          ))}
        </ul>

        {/* right â€” helpline */}
        <div className="rounded-xl border border-[#EDF1F7] bg-white p-5 shadow-sm lg:p-6">
          <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-[#7B8BA5]">
            National Emergency Helpline
          </p>
          <div className="mt-2 flex items-center gap-3">
            <span className="flex h-11 w-11 items-center justify-center rounded-full bg-[#FFF0DF] text-[#F57C00]">
              <PhoneCall className="h-5 w-5" aria-hidden />
            </span>
            <a
              href="tel:112"
              className="text-[34px] font-extrabold leading-none tracking-tight text-[#F57C00] transition-colors hover:text-[#C05F00]"
            >
              112
            </a>
          </div>
          <p className="mt-2.5 text-[12px] leading-[1.6] text-[#52627A]">
            For medical emergencies, call 112 or visit the nearest hospital.
          </p>
        </div>
      </div>

      <div className="border-t border-[#EEF2F8] py-4 text-center text-[11.5px] font-medium text-[#8CA3C3]">
        © {new Date().getFullYear()} Jeevan Sahay · Healthcare for All Initiative
      </div>
    </footer>
  );
}
