"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { Activity, Building2, ClipboardList, LayoutDashboard, LogOut, Menu, Users, X } from "lucide-react";
import * as React from "react";
import { BrandLockup } from "@/components/brand";
import { useAuth } from "@/components/auth-context";
import { Button } from "@/components/ui/button";

const navigation = [
  { href: "/admin", label: "Overview", icon: LayoutDashboard },
  { href: "/admin/hospitals", label: "Hospital verification", icon: Building2 },
  { href: "/admin/users", label: "Accounts", icon: Users },
  { href: "/admin/reports", label: "Reports", icon: ClipboardList },
  { href: "/admin/audit", label: "Audit trail", icon: Activity },
];

export function AdminLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const { user, logout } = useAuth();
  const [menuOpen, setMenuOpen] = React.useState(false);

  function active(href: string) {
    return href === "/admin" ? pathname === href : pathname === href || pathname.startsWith(`${href}/`);
  }

  async function signOut() {
    await logout();
    router.replace("/login");
    router.refresh();
  }

  const links = (
    <nav aria-label="Admin navigation" className="space-y-1">
      {navigation.map((item) => {
        const Icon = item.icon;
        return (
          <Link
            key={item.href}
            href={item.href}
            onClick={() => setMenuOpen(false)}
            aria-current={active(item.href) ? "page" : undefined}
            className={`flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors ${active(item.href) ? "bg-white text-primary-900 shadow-sm" : "text-primary-100/85 hover:bg-white/10 hover:text-white"}`}
          >
            <Icon className="h-4 w-4 shrink-0" aria-hidden />{item.label}
          </Link>
        );
      })}
    </nav>
  );

  return (
    <div className="min-h-screen bg-paper">
      <aside className="fixed inset-y-0 left-0 z-30 hidden w-72 flex-col bg-primary-950 lg:flex">
        <Link href="/" className="border-b border-white/10 px-5 py-5"><BrandLockup light /></Link>
        <div className="px-3 py-5"><p className="mb-3 px-3 text-[11px] font-semibold uppercase tracking-[0.14em] text-primary-100/60">Platform administration</p>{links}</div>
        <div className="mt-auto border-t border-white/10 p-4">
          <p className="truncate text-xs text-primary-100/70">{user?.email ?? "Super administrator"}</p>
          <Button variant="ghost" className="mt-2 w-full justify-start gap-2 text-primary-100 hover:bg-white/10 hover:text-white" onClick={() => void signOut()}><LogOut className="h-4 w-4" aria-hidden />Sign out</Button>
        </div>
      </aside>
      <div className="lg:pl-72">
        <header className="sticky top-0 z-20 flex h-16 items-center justify-between border-b border-slate-200 bg-white/95 px-4 backdrop-blur sm:px-6 lg:px-8">
          <div className="flex items-center gap-3">
            <Button variant="ghost" size="icon" className="lg:hidden" aria-label={menuOpen ? "Close navigation" : "Open navigation"} onClick={() => setMenuOpen((open) => !open)}>{menuOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}</Button>
            <span className="text-sm font-semibold text-primary-950">Super administrator</span>
          </div>
          <span className="hidden text-sm text-slate-500 sm:block">{user?.name ?? ""}</span>
        </header>
        {menuOpen && <div className="fixed inset-0 z-40 bg-primary-950/40 lg:hidden" onClick={() => setMenuOpen(false)}>
          <div className="h-full w-72 bg-primary-950 p-4" onClick={(event) => event.stopPropagation()}>
            <div className="mb-6 flex items-center justify-between"><BrandLockup light compact /><Button variant="ghost" size="icon" aria-label="Close navigation" onClick={() => setMenuOpen(false)}><X className="h-5 w-5 text-white" /></Button></div>
            {links}
            <Button variant="ghost" className="mt-6 w-full justify-start gap-2 text-primary-100 hover:bg-white/10 hover:text-white" onClick={() => void signOut()}><LogOut className="h-4 w-4" aria-hidden />Sign out</Button>
          </div>
        </div>}
        <main id="main-content" className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8 lg:py-8">{children}</main>
      </div>
    </div>
  );
}
