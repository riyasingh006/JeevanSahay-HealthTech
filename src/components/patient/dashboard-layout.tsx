"use client";

import * as React from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  Activity,
  BedDouble,
  BellRing,
  Building2,
  CalendarCheck,
  CircleHelp,
  ClipboardPlus,
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

/** Dashboard-local brand lockup — uses the official Jeevan Sahay logo asset. */
function DashboardBrand({ plain = false }: { plain?: boolean }) {
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
        <span
          className={`${plain ? "text-xl" : "text-[23px]"} font-bold tracking-tight`}
        >
          <span className="font-devanagari" style={{ color: "#F57C00" }}>
            जीवन
          </span>{" "}
          <span style={{ color: "#062B67" }}>Sahay</span>
        </span>
        <span
          className="mt-1.5 whitespace-nowrap text-[11px] font-semibold uppercase tracking-[0.8px]"
          style={{ color: "#F57C00" }}
        >
          Patient Application
        </span>
      </span>
    </span>
  );
}

interface NavItem {
  href: string;
  label: string;
  icon: React.ComponentType<{ className?: string; "aria-hidden"?: boolean }>;
  external?: boolean;
  tone?: "emergency" | "default";
}

const NAV_MAIN: NavItem[] = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/dashboard/hospitals", label: "Find Hospitals", icon: Building2 },
  { href: "/dashboard/doctors", label: "Doctors", icon: Stethoscope },
  { href: "/dashboard/specialists", label: "Specialists", icon: ClipboardPlus },
  { href: "/dashboard/services", label: "Healthcare Services", icon: HeartPulse },
  { href: "/dashboard/beds", label: "Bed Availability", icon: BedDouble },
  {
    href: "/dashboard/ai-assistant",
    label: "AI Healthcare Assistant",
    icon: CircleHelp,
  },
];

const NAV_PATIENT: NavItem[] = [
  { href: "/dashboard/emergency", label: "Emergency Mode", icon: Siren, tone: "emergency" },
  { href: "/dashboard/saved", label: "Saved Hospitals", icon: CalendarCheck },
  { href: "/dashboard/profile", label: "Medical Profile", icon: UserRound },
  { href: "/dashboard/notifications", label: "Notifications", icon: BellRing },
  { href: "/dashboard/settings", label: "Settings", icon: Settings },
];

function NavLink({
  item,
  active,
  unread,
  onNavigate,
}: {
  item: NavItem;
  active: boolean;
  unread: number;
  onNavigate?: () => void;
}) {
  const Icon = item.icon;
  const inner = (
    <>
      <Icon className="h-4 w-4 shrink-0" aria-hidden />
      <span className="truncate">{item.label}</span>
      {item.href === "/dashboard/notifications" && unread > 0 && (
        <span className="ml-auto inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-saffron-500 px-1 text-[11px] font-bold text-primary-950">
          {unread}
        </span>
      )}
      {item.tone === "emergency" && (
        <Siren className="ml-auto h-3.5 w-3.5 text-red-300" aria-hidden />
      )}
    </>
  );
  const cls = `flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
    active
      ? "bg-white/15 text-white"
      : item.tone === "emergency"
        ? "text-red-200 hover:bg-white/10 hover:text-white"
        : "text-primary-100/85 hover:bg-white/10 hover:text-white"
  }`;
  if (item.external) {
    return (
      <a href={item.href} className={cls} onClick={onNavigate}>
        {inner}
      </a>
    );
  }
  return (
    <Link href={item.href} className={cls} aria-current={active ? "page" : undefined} onClick={onNavigate}>
      {inner}
    </Link>
  );
}

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const { user, loading, logout } = useAuth();
  const [drawerOpen, setDrawerOpen] = React.useState(false);
  const [unread, setUnread] = React.useState(0);

  const displayName =
    user?.name?.trim() || user?.email?.split("@")[0]?.trim() || "User";

  React.useEffect(() => {
    let alive = true;
    fetch("/api/notifications", { cache: "no-store" })
      .then((r) => r.json())
      .then((json) => {
        if (alive && json.ok) setUnread(json.data.unread ?? 0);
      })
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, [pathname]);

  React.useEffect(() => {
    setDrawerOpen(false);
  }, [pathname]);

  const isActive = (href: string) =>
    href === "/dashboard" ? pathname === "/dashboard" : pathname.startsWith(href);

  function renderNav(onNavigate?: () => void) {
    return (
      <>
        <p className="px-3 pb-2 pt-1 text-[11px] font-semibold uppercase tracking-wider text-primary-200/70">
          Care Navigation
        </p>
        <nav className="space-y-1" aria-label="Patient portal">
          {NAV_MAIN.map((item) => (
            <NavLink
              key={item.href}
              item={item}
              active={!item.external && isActive(item.href)}
              unread={unread}
              onNavigate={onNavigate}
            />
          ))}
        </nav>
        <p className="px-3 pb-2 pt-5 text-[11px] font-semibold uppercase tracking-wider text-primary-200/70">
          My Health
        </p>
        <nav className="space-y-1" aria-label="My health">
          {NAV_PATIENT.map((item) => (
            <NavLink
              key={item.href}
              item={item}
              active={isActive(item.href)}
              unread={unread}
              onNavigate={onNavigate}
            />
          ))}
        </nav>
      </>
    );
  }

  return (
    <div className="min-h-screen bg-paper">
      {/* ---------- Desktop sidebar ---------- */}
      <aside className="fixed inset-y-0 left-0 z-40 hidden w-64 flex-col bg-primary-950 lg:flex print:hidden">
        <div className="border-b border-white/10 px-4 py-4">
          <Link href="/" aria-label="Jeevan Sahay home" className="block w-fit">
            <DashboardBrand />
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
        </div>
      </aside>

      {/* ---------- Mobile drawer ---------- */}
      {drawerOpen && (
        <div className="fixed inset-0 z-50 lg:hidden" role="dialog" aria-modal="true" aria-label="Portal menu">
          <button
            type="button"
            aria-label="Close menu"
            className="absolute inset-0 bg-primary-950/50 backdrop-blur-sm animate-fade-in"
            onClick={() => setDrawerOpen(false)}
          />
          <div className="absolute inset-y-0 left-0 flex w-72 max-w-[85vw] flex-col bg-primary-950 shadow-overlay animate-fade-in">
            <div className="flex items-center justify-between gap-2 border-b border-white/10 px-4 py-4">
              <DashboardBrand />
              <Button variant="ghost" size="icon" className="text-white hover:bg-white/10" onClick={() => setDrawerOpen(false)} aria-label="Close menu">
                <X className="h-5 w-5" aria-hidden />
              </Button>
            </div>
            <div className="flex-1 overflow-y-auto px-3 py-4">{renderNav(() => setDrawerOpen(false))}</div>
            <div className="border-t border-white/10 p-3">
              <a href="tel:112" className="flex items-center justify-center gap-2 rounded-lg bg-[#B42318] px-3 py-2.5 text-sm font-semibold text-white">
                <Activity className="h-4 w-4" aria-hidden /> Emergency 112
              </a>
            </div>
          </div>
        </div>
      )}

      <div className="lg:pl-64">
        {/* ---------- Portal header ---------- */}
        <header className="sticky top-0 z-30 border-b border-slate-200 bg-white/95 backdrop-blur print:hidden">
          <div className="container flex h-16 items-center justify-between gap-3">
            <div className="flex min-w-0 items-center gap-2">
              <Button
                variant="ghost"
                size="icon"
                className="lg:hidden"
                onClick={() => setDrawerOpen(true)}
                aria-label="Open menu"
              >
                <Menu className="h-5 w-5" aria-hidden />
              </Button>
              <span className="lg:hidden">
                <Link href="/" aria-label="Jeevan Sahay home">
                  <DashboardBrand plain />
                </Link>
              </span>
              <span className="hidden truncate text-sm font-semibold text-primary-900 lg:block">
                Patient Application Portal
              </span>
            </div>

            <div className="flex items-center gap-2.5">
              <Link
                href="/dashboard/notifications"
                className="relative rounded-lg p-2 text-slate-500 hover:bg-primary-50 hover:text-primary-700"
                aria-label={`Notifications${unread > 0 ? ` — ${unread} unread` : ""}`}
              >
                <BellRing className="h-5 w-5" aria-hidden />
                {unread > 0 && (
                  <span className="absolute right-1 top-1 h-2 w-2 rounded-full bg-saffron-500" />
                )}
              </Link>
              <span className="hidden items-center gap-2 border-l border-slate-200 pl-2.5 sm:flex">
                <span className="flex h-8 w-8 items-center justify-center rounded-full bg-primary-700 text-sm font-bold text-white">
                  {(displayName.slice(0, 1) || "U").toUpperCase()}
                </span>
                {!loading && (
                  <span className="max-w-36 truncate text-sm font-semibold text-primary-950">
                    {displayName}
                  </span>
                )}
              </span>
              <Button
                variant="ghost"
                size="sm"
                className="gap-2 text-red-700"
                onClick={() => {
                  void logout()
                    .catch(() => {})
                    .finally(() => {
                      router.push("/");
                      router.refresh();
                    });
                }}
              >
                <LogOut className="h-4 w-4" aria-hidden /> Logout
              </Button>
            </div>
          </div>
        </header>

        <main id="main-content" className="container py-6 pb-16 md:py-8">
          {children}
        </main>
      </div>
    </div>
  );
}
