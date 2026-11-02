"use client";

import * as React from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  Activity,
  BarChart3,
  BedDouble,
  BellRing,
  Building2,
  CalendarClock,
  HeartPulse,
  LayoutDashboard,
  LogOut,
  Menu,
  Settings,
  Siren,
  Stethoscope,
  UserRound,
  X,
} from "lucide-react";
import Image from "next/image";
import logoAsset from "@/components/landing/logo/3af76e7bd07c86d6e6e08b17eef080c0.jpg";
import { useAuth } from "@/components/auth-context";
import { Button } from "@/components/ui/button";
import { HospitalDemoProvider, useHospitalDemo } from "@/components/hospital/hospital-store";
import { DemoDataBadge } from "@/components/hospital/hospital-ui";

function HospitalBrand({ plain = false }: { plain?: boolean }) {
  return (
    <span
      className={`flex items-center gap-3 ${plain ? "" : "rounded-xl bg-white px-3 py-2.5 shadow-card"}`}
    >
      <Image
        src={logoAsset}
        alt="Jeevan Sahay logo"
        width={plain ? 44 : 50}
        height={plain ? 44 : 50}
        priority
        className="shrink-0 object-contain"
      />
      <span className="flex min-w-0 flex-col justify-center leading-none">
        <span className={`${plain ? "text-xl" : "text-[23px]"} font-bold tracking-tight`}>
          <span className="font-devanagari" style={{ color: "#F57C00" }}>
            जीवन
          </span>{" "}
          <span style={{ color: "#062B67" }}>Sahay</span>
        </span>
        <span
          className="mt-1.5 whitespace-nowrap text-[11px] font-semibold uppercase tracking-[0.8px]"
          style={{ color: "#F57C00" }}
        >
          Hospital Portal
        </span>
      </span>
    </span>
  );
}

interface NavItem {
  href: string;
  label: string;
  icon: React.ComponentType<{ className?: string; "aria-hidden"?: boolean }>;
  tone?: "emergency" | "default";
}

const NAV_MAIN: NavItem[] = [
  { href: "/hospital", label: "Hospital Overview", icon: LayoutDashboard },
  { href: "/hospital/beds", label: "Bed Management", icon: BedDouble },
  { href: "/hospital/doctors", label: "Doctor Management", icon: Stethoscope },
  { href: "/hospital/departments", label: "Department Management", icon: Building2 },
  { href: "/hospital/emergency", label: "Emergency Status", icon: Siren, tone: "emergency" },
  { href: "/hospital/services", label: "Healthcare Services", icon: HeartPulse },
  { href: "/hospital/appointments", label: "Appointments", icon: CalendarClock },
];

const NAV_HOSP: NavItem[] = [
  { href: "/hospital/analytics", label: "Analytics & Reports", icon: BarChart3 },
  { href: "/hospital/profile", label: "Hospital Profile", icon: UserRound },
  { href: "/hospital/settings", label: "Settings", icon: Settings },
];

function NavLink({
  item,
  active,
  onNavigate,
}: {
  item: NavItem;
  active: boolean;
  onNavigate?: () => void;
}) {
  const Icon = item.icon;
  const cls = `flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
    active
      ? "bg-white/15 text-white"
      : item.tone === "emergency"
        ? "text-red-200 hover:bg-white/10 hover:text-white"
        : "text-primary-100/85 hover:bg-white/10 hover:text-white"
  }`;
  return (
    <Link href={item.href} className={cls} aria-current={active ? "page" : undefined} onClick={onNavigate}>
      <Icon className="h-4 w-4 shrink-0" aria-hidden />
      <span className="truncate">{item.label}</span>
      {item.tone === "emergency" && <Siren className="ml-auto h-3.5 w-3.5 text-red-300" aria-hidden />}
    </Link>
  );
}

export default function HospitalLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const { user, loading, logout } = useAuth();
  const [drawerOpen, setDrawerOpen] = React.useState(false);

  const displayName = user?.name?.trim() || user?.email?.split("@")[0]?.trim() || "Hospital Admin";

  React.useEffect(() => {
    setDrawerOpen(false);
  }, [pathname]);

  const isActive = (href: string) => (href === "/hospital" ? pathname === "/hospital" : pathname.startsWith(href));

  function renderNav(onNavigate?: () => void) {
    return (
      <>
        <p className="px-3 pb-2 pt-1 text-[11px] font-semibold uppercase tracking-wider text-primary-200/70">
          Hospital Management
        </p>
        <nav className="space-y-1" aria-label="Hospital portal">
          {NAV_MAIN.map((item) => (
            <NavLink key={item.href} item={item} active={isActive(item.href)} onNavigate={onNavigate} />
          ))}
        </nav>
        <p className="px-3 pb-2 pt-5 text-[11px] font-semibold uppercase tracking-wider text-primary-200/70">
          Administration
        </p>
        <nav className="space-y-1" aria-label="Hospital admin">
          {NAV_HOSP.map((item) => (
            <NavLink key={item.href} item={item} active={isActive(item.href)} onNavigate={onNavigate} />
          ))}
        </nav>
      </>
    );
  }

  function HospitalShell() {
    const { notifications } = useHospitalDemo();
    const unread = notifications.filter((item) => !item.read).length;

    return (
      <div className="min-h-screen bg-paper">
        <aside className="fixed inset-y-0 left-0 z-40 hidden w-72 flex-col bg-primary-950 lg:flex print:hidden">
          <div className="border-b border-white/10 px-4 py-4">
            <Link href="/" aria-label="Jeevan Sahay home" className="block w-fit">
              <HospitalBrand />
            </Link>
          </div>
          <div className="flex-1 overflow-y-auto px-3 py-4">{renderNav()}</div>
          <div className="border-t border-white/10 p-3">
            <a
              href="tel:112"
              className="flex items-center justify-center gap-2 rounded-lg bg-[#B42318] px-3 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-[#912018]"
            >
              <Activity className="h-4 w-4" aria-hidden /> Emergency 112
            </a>
            <Button
              variant="ghost"
              className="mt-2 w-full justify-start gap-2 text-primary-100/85 hover:bg-white/10 hover:text-white"
              onClick={() => void logout().then(() => { router.push("/"); router.refresh(); })}
            >
              <LogOut className="h-4 w-4" aria-hidden /> Logout
            </Button>
          </div>
        </aside>

        {drawerOpen && (
          <div className="fixed inset-0 z-50 lg:hidden" role="dialog" aria-modal="true" aria-label="Hospital menu">
            <button type="button" aria-label="Close menu" className="absolute inset-0 bg-primary-950/50 backdrop-blur-sm animate-fade-in" onClick={() => setDrawerOpen(false)} />
            <div className="absolute inset-y-0 left-0 flex w-[80vw] max-w-[320px] flex-col bg-primary-950 shadow-overlay animate-fade-in">
              <div className="flex items-center justify-between gap-2 border-b border-white/10 px-4 py-4">
                <HospitalBrand />
                <Button variant="ghost" size="icon" className="text-white hover:bg-white/10" onClick={() => setDrawerOpen(false)} aria-label="Close menu">
                  <X className="h-5 w-5" aria-hidden />
                </Button>
              </div>
              <div className="flex-1 overflow-y-auto px-3 py-4">{renderNav(() => setDrawerOpen(false))}</div>
              <div className="border-t border-white/10 p-3">
                <a href="tel:112" className="flex items-center justify-center gap-2 rounded-lg bg-[#B42318] px-3 py-2.5 text-sm font-semibold text-white">
                  <Activity className="h-4 w-4" aria-hidden /> Emergency 112
                </a>
                <Button
                  variant="ghost"
                  className="mt-2 w-full justify-start gap-2 text-primary-100/85 hover:bg-white/10 hover:text-white"
                  onClick={() => void logout().then(() => { router.push("/"); router.refresh(); })}
                >
                  <LogOut className="h-4 w-4" aria-hidden /> Logout
                </Button>
              </div>
            </div>
          </div>
        )}

        <div className="lg:pl-72">
          <header className="sticky top-0 z-30 border-b border-slate-200 bg-white/95 backdrop-blur print:hidden">
            <div className="mx-auto flex h-16 max-w-7xl items-center justify-between gap-3 px-4 sm:px-6 lg:px-8">
              <div className="flex min-w-0 items-center gap-2">
                <Button variant="ghost" size="icon" className="lg:hidden" onClick={() => setDrawerOpen(true)} aria-label="Open menu">
                  <Menu className="h-5 w-5" aria-hidden />
                </Button>
                <span className="lg:hidden">
                  <Link href="/" aria-label="Jeevan Sahay home">
                    <HospitalBrand plain />
                  </Link>
                </span>
                <div className="hidden items-center gap-2 lg:flex">
                  <span className="truncate text-sm font-semibold text-primary-950">Hospital Management Portal</span>
                  <DemoDataBadge />
                </div>
              </div>

              <div className="flex items-center gap-2.5">
                <Link href="/hospital/notifications" className="relative rounded-lg p-2 text-slate-500 hover:bg-primary-50 hover:text-primary-700" aria-label="Notifications">
                  <BellRing className="h-5 w-5" aria-hidden />
                  {unread > 0 && (
                    <span className="absolute -right-0.5 -top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-[#B42318] px-1 text-[10px] font-bold text-white">
                      {unread}
                    </span>
                  )}
                </Link>
                <span className="hidden items-center gap-2 border-l border-slate-200 pl-2.5 sm:flex">
                  <span className="flex h-8 w-8 items-center justify-center rounded-full bg-primary-700 text-sm font-bold text-white">
                    {(displayName.slice(0, 1) || "H").toUpperCase()}
                  </span>
                  {!loading && <span className="max-w-36 truncate text-sm font-semibold text-primary-950">{displayName}</span>}
                </span>
                <Button
                  variant="ghost"
                  size="sm"
                  className="gap-2 text-red-700"
                  onClick={() => void logout().then(() => { router.push("/"); router.refresh(); })}
                >
                  <LogOut className="h-4 w-4" aria-hidden /> Logout
                </Button>
              </div>
            </div>
          </header>

          <main id="main-content" className="mx-auto max-w-7xl px-4 py-6 pb-16 sm:px-6 md:py-8 lg:px-8">
            {children}
          </main>
        </div>
      </div>
    );
  }

  return (
    <HospitalDemoProvider>
      <HospitalShell />
    </HospitalDemoProvider>
  );
}
