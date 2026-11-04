"use client";

import Link from "next/link";
import { BrandMark } from "@/components/brand";
import { useI18n } from "@/lib/i18n";

const COLUMNS: { title: string; links: { href: string; label: string }[] }[] = [
  {
    title: "जीवन Sahay",
    links: [
      { href: "/info/about", label: "About" },
      { href: "/info/about#mission", label: "Mission" },
      { href: "/info/contact", label: "Contact" },
    ],
  },
  {
    title: "Services",
    links: [
      { href: "/hospitals", label: "Find Hospital" },
      { href: "/ai-assistant", label: "AI Assistant" },
      { href: "/emergency", label: "Emergency" },
      { href: "/doctors", label: "Doctors" },
    ],
  },
  {
    title: "Information",
    links: [
      { href: "/info/privacy", label: "Privacy Policy" },
      { href: "/info/terms", label: "Terms of Use" },
      { href: "/info/accessibility", label: "Accessibility" },
      { href: "/info/disclaimer", label: "Disclaimer" },
    ],
  },
  {
    title: "Support",
    links: [
      { href: "/info/help", label: "Help Center" },
      { href: "/feedback", label: "Feedback & Complaints" },
      { href: "/signup?role=HOSPITAL_ADMIN", label: "Register Your Hospital" },
    ],
  },
];

export function SiteFooter() {
  const { t } = useI18n();
  return (
    <footer className="mt-auto border-t-4 border-saffron-500 bg-primary-950 text-primary-100">
      <div className="container grid gap-10 py-12 md:grid-cols-[1.4fr_repeat(4,1fr)]">
        <div>
          <div className="flex items-center gap-2.5">
            <BrandMark className="h-9 w-9" />
            <p className="text-lg font-semibold text-white">
              <span className="font-devanagari">जीवन</span>{" "}
              <span className="text-saffron-400">Sahay</span>
            </p>
          </div>
          <p className="mt-3 font-devanagari text-sm text-primary-200">
            सही अस्पताल • सही समय • सही दिशा
          </p>
          <p className="mt-3 max-w-xs text-xs leading-relaxed text-primary-300">
            An AI-powered healthcare navigation platform helping citizens find
            the right care at the right time.
          </p>
          <a
            href="tel:112"
            className="mt-4 inline-flex items-center gap-2 rounded-lg border border-red-400/40 bg-red-500/10 px-3 py-2 text-sm font-bold text-red-300 hover:bg-red-500/20"
          >
            🚨 Emergency: 112
          </a>
        </div>

        {COLUMNS.map((col) => (
          <nav key={col.title} aria-label={col.title}>
            <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-400">
              {col.title}
            </h3>
            <ul className="mt-4 space-y-2.5">
              {col.links.map((link) => (
                <li key={link.href + link.label}>
                  <Link
                    href={link.href}
                    className="text-sm text-primary-200 transition-colors hover:text-white hover:underline underline-offset-4"
                  >
                    {link.label}
                  </Link>
                </li>
              ))}
            </ul>
          </nav>
        ))}
      </div>

      <div className="border-t border-primary-800">
        <div className="container flex flex-col gap-2 py-4 text-xs text-primary-300 md:flex-row md:items-center md:justify-between">
          <p>{t("footer.rights")}</p>
          <p className="max-w-xl leading-relaxed">{t("footer.disclaimer")}</p>
        </div>
      </div>
    </footer>
  );
}
