"use client";

import * as React from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  Bell,
  ChevronDown,
  CircleHelp,
  LayoutDashboard,
  LogOut,
  Menu,
  PhoneCall,
  Siren,
  Stethoscope,
  UserRound,
  X,
} from "lucide-react";
import { BrandLockup } from "@/components/brand";
import { useAccessibility } from "@/components/accessibility";
import { useAuth } from "@/components/auth-context";
import { useI18n } from "@/lib/i18n";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";

const NAV_ITEMS: { href: string; key: string; label?: string }[] = [
  { href: "/", key: "nav.home" },
  { href: "/hospitals", key: "nav.findHospital" },
  { href: "/ai-assistant", key: "nav.aiAssistant" },
  { href: "/doctors", key: "nav.doctors" },
  { href: "/services", key: "nav.services" },
  { href: "/emergency", key: "nav.emergency" },
  // Scrolls to the How It Works section on the public landing page.
  { href: "/#how-it-works", key: "nav.howItWorks", label: "How It Works" },
  { href: "/info/about", key: "nav.about" },
];

export function SiteHeader() {
  const { t, lang, setLang } = useI18n();
  const { user, loading, logout } = useAuth();
  const a11y = useAccessibility();
  const pathname = usePathname();
  const router = useRouter();
  const [mobileOpen, setMobileOpen] = React.useState(false);

  React.useEffect(() => setMobileOpen(false), [pathname]);

  // Safe display identity — the auth contract always includes name/email, but
  // runtime data (stale/partial session payloads) must never crash the header.
  const displayName =
    user?.name?.trim() || user?.email?.split("@")[0]?.trim() || "User";
  const firstName = displayName.split(/[.\s_-]/)[0] || "User";
  const avatarInitial = (displayName.slice(0, 1) || "U").toUpperCase();

  const isActive = (href: string) =>
    href === "/" ? pathname === "/" : pathname.startsWith(href);

  return (
    <header className="sticky top-0 z-50">
      {/* ---------- Utility bar ---------- */}
      <div className="bg-primary-950 text-primary-100">
        <div className="container flex h-9 items-center justify-between text-xs">
          <p className="hidden items-center gap-2 sm:flex">
            <span className="font-devanagari font-medium">भारत</span>
            <span aria-hidden className="text-primary-400">|</span>
            <span>National Healthcare Navigation Initiative</span>
          </p>
          <nav
            aria-label="Utility"
            className="ml-auto flex items-center divide-x divide-primary-800"
          >
            <a
              href="#main-content"
              className="px-3 hover:text-white focus-visible:outline focus-visible:outline-2 focus-visible:-outline-offset-4 focus-visible:outline-saffron-300"
            >
              {t("util.skip")}
            </a>
            <button
              onClick={a11y.openPanel}
              className="hidden px-3 hover:text-white sm:block"
            >
              {t("util.accessibility")}
            </button>
            <div className="flex items-center px-1.5" role="group" aria-label="Language">
              <button
                onClick={() => setLang("en")}
                aria-pressed={lang === "en"}
                className={cn(
                  "rounded px-1.5 py-0.5",
                  lang === "en" ? "font-semibold text-white underline underline-offset-4" : "hover:text-white"
                )}
              >
                English
              </button>
              <span aria-hidden className="text-primary-600">/</span>
              <button
                onClick={() => setLang("hi")}
                aria-pressed={lang === "hi"}
                className={cn(
                  "rounded px-1.5 py-0.5 font-devanagari",
                  lang === "hi" ? "font-semibold text-white underline underline-offset-4" : "hover:text-white"
                )}
              >
                हिंदी
              </button>
            </div>
            <Link href="/info/help" className="px-3 hover:text-white">
              {t("util.help")}
            </Link>
            <Link
              href="/emergency"
              className="flex items-center gap-1.5 bg-[#B42318] px-3 py-1.5 font-semibold text-white hover:bg-[#912018]"
            >
              <Siren className="h-3.5 w-3.5" aria-hidden />
              <span className="hidden xs:inline">{t("nav.emergency")}</span>
              <span className="xs:hidden">SOS</span>
            </Link>
          </nav>
        </div>
      </div>

      {/* ---------- Main header ---------- */}
      <div className="border-b border-slate-200 bg-white/95 shadow-sm backdrop-blur supports-[backdrop-filter]:bg-white/85">
        <div className="container flex h-16 items-center justify-between gap-4">
          <Link
            href="/"
            aria-label={`${t("brand.sub")} — home`}
            className="shrink-0 rounded-md focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary-600"
          >
            <BrandLockup />
          </Link>

          <nav aria-label="Primary" className="hidden xl:block">
            <ul className="flex items-center gap-0.5">
              {NAV_ITEMS.map((item) => (
                <li key={item.href}>
                  <Link
                    href={item.href}
                    aria-current={isActive(item.href) ? "page" : undefined}
                    className={cn(
                      "relative rounded-md px-3 py-2 text-sm font-medium transition-colors",
                      isActive(item.href)
                        ? "text-primary-800 after:absolute after:inset-x-3 after:-bottom-[13px] after:h-0.5 after:bg-care-500"
                        : "text-slate-600 hover:bg-primary-50/70 hover:text-primary-800"
                    )}
                  >
                    {item.label ?? t(item.key)}
                  </Link>
                </li>
              ))}
            </ul>
          </nav>

          <div className="flex items-center gap-1.5">
            {user && user.role !== "SUPER_ADMIN" && (
              <Link
                href={user.role === "HOSPITAL_ADMIN" ? "/hospital/notifications" : "/dashboard/notifications"}
                aria-label={t("util.notifications")}
                className="relative hidden rounded-lg p-2 text-slate-500 hover:bg-primary-50 hover:text-primary-700 md:block"
              >
                <Bell className="h-5 w-5" aria-hidden />
                <span className="absolute right-1.5 top-1.5 h-2 w-2 rounded-full bg-saffron-500" />
              </Link>
            )}

            {loading && (
              <div className="hidden items-center gap-2 sm:flex" aria-hidden="true">
                <span className="h-7 w-7 animate-pulse rounded-full bg-slate-200" />
                <span className="h-4 w-16 animate-pulse rounded bg-slate-100" />
              </div>
            )}

            {!loading &&
              (user ? (
                <div className="hidden xl:block">
                  <DropdownMenu>
                  <DropdownMenuTrigger className="flex items-center gap-2 rounded-lg border border-slate-200 py-1.5 pl-1.5 pr-2.5 text-sm font-medium text-primary-900 shadow-sm transition-colors hover:border-primary-300 hover:bg-primary-50">
                    <span className="flex h-7 w-7 items-center justify-center rounded-full bg-primary-700 text-xs font-bold text-white">
                      {avatarInitial}
                    </span>
                    <span className="hidden max-w-[120px] truncate md:inline">
                      {firstName}
                    </span>
                    <ChevronDown className="h-3.5 w-3.5 text-slate-400" aria-hidden />
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    <DropdownMenuLabel>{user?.email ?? displayName}</DropdownMenuLabel>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem onClick={() => router.push("/dashboard")}>
                      <LayoutDashboard className="h-4 w-4 text-slate-400" aria-hidden />
                      {t("nav.dashboard")}
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => router.push("/dashboard/profile")}>
                      <UserRound className="h-4 w-4 text-slate-400" aria-hidden />
                      Profile & Health Records
                    </DropdownMenuItem>
                    {(user.role === "HOSPITAL_ADMIN" ||
                      user.role === "SUPER_ADMIN") && (
                      <DropdownMenuItem onClick={() => router.push("/hospital")}>
                        <Stethoscope className="h-4 w-4 text-slate-400" aria-hidden />
                        Hospital Portal
                      </DropdownMenuItem>
                    )}
                    {user.role === "SUPER_ADMIN" && (
                      <DropdownMenuItem onClick={() => router.push("/admin")}>
                        <CircleHelp className="h-4 w-4 text-slate-400" aria-hidden />
                        Super Admin Panel
                      </DropdownMenuItem>
                    )}
                    <DropdownMenuSeparator />
                    <DropdownMenuItem
                      className="text-red-700 focus:bg-red-50 focus:text-red-800"
                      onClick={() => void logout().then(() => router.push("/"))}
                    >
                      <LogOut className="h-4 w-4" aria-hidden />
                      {t("nav.logout")}
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                  </DropdownMenu>
                </div>
              ) : (
                <div className="hidden items-center gap-2 sm:flex">
                  <Link
                    href="/login"
                    className="rounded-lg px-3.5 py-2 text-sm font-semibold text-primary-800 hover:bg-primary-50"
                  >
                    {t("nav.login")}
                  </Link>
                  <Link
                    href="/signup"
                    className="inline-flex h-9 items-center rounded-lg bg-primary-700 px-4 text-sm font-semibold text-white shadow-sm hover:bg-primary-800"
                  >
                    {t("nav.signup")}
                  </Link>
                </div>
              ))}

            <button
              className="rounded-lg p-2 text-slate-600 hover:bg-primary-50 xl:hidden"
              aria-expanded={mobileOpen}
              aria-controls="mobile-menu"
              aria-label="Open menu"
              onClick={() => setMobileOpen((o) => !o)}
            >
              {mobileOpen ? (
                <X className="h-6 w-6" aria-hidden />
              ) : (
                <Menu className="h-6 w-6" aria-hidden />
              )}
            </button>
          </div>
        </div>

        {/* ---------- Mobile menu ---------- */}
        {mobileOpen && (
          <div id="mobile-menu" className="border-t border-slate-200 bg-white xl:hidden">
            <nav aria-label="Mobile" className="container py-3">
              <ul className="divide-y divide-slate-100">
                {NAV_ITEMS.map((item) => (
                  <li key={item.href}>
                    <Link
                      href={item.href}
                      aria-current={isActive(item.href) ? "page" : undefined}
                      className={cn(
                        "block py-3 text-sm font-medium",
                        isActive(item.href)
                          ? "text-care-600"
                          : "text-slate-700 hover:text-primary-800"
                      )}
                    >
                      {item.label ?? t(item.key)}
                    </Link>
                  </li>
                ))}
              </ul>
              <div className="mt-3 flex flex-col gap-2 border-t border-slate-200 pt-4 pb-2">
                <a
                  href="tel:112"
                  className="flex items-center justify-center gap-2 rounded-lg bg-[#B42318] py-3 text-sm font-bold uppercase tracking-wide text-white"
                >
                  <PhoneCall className="h-4 w-4" aria-hidden /> Emergency 112
                </a>
                {user ? (
                  <>
                    <Link
                      href="/dashboard"
                      className="flex items-center justify-center gap-2 rounded-lg border border-slate-300 py-2.5 text-sm font-semibold text-primary-800"
                    >
                      <LayoutDashboard className="h-4 w-4" aria-hidden />{" "}
                      {t("nav.dashboard")}
                    </Link>
                    <button
                      onClick={() =>
                        void logout().then(() => {
                          router.push("/");
                          router.refresh();
                        })
                      }
                      className="rounded-lg py-2 text-sm font-semibold text-red-700"
                    >
                      {t("nav.logout")}
                    </button>
                  </>
                ) : (
                  <div className="grid grid-cols-2 gap-2">
                    <Link
                      href="/login"
                      className="rounded-lg border border-slate-300 py-2.5 text-center text-sm font-semibold text-primary-800"
                    >
                      {t("nav.login")}
                    </Link>
                    <Link
                      href="/signup"
                      className="rounded-lg bg-primary-700 py-2.5 text-center text-sm font-semibold text-white"
                    >
                      {t("nav.signup")}
                    </Link>
                  </div>
                )}
              </div>
            </nav>
          </div>
        )}
      </div>
    </header>
  );
}
