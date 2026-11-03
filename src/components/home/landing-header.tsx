"use client";

import * as React from "react";
import Link from "next/link";
import { Menu, X } from "lucide-react";
import { cn } from "@/lib/utils";
import brandLogo from "@/components/landing/logo/3af76e7bd07c86d6e6e08b17eef080c0.jpg";

const NAV = [
  { label: "Home", href: "#top", active: true },
  { label: "Features", href: "#features" },
  { label: "How It Works", href: "#how-it-works" },
  { label: "How it works", href: "#testimonials" },
  { label: "About Us", href: "#about" },
];

export function LandingHeader() {
  const [scrolled, setScrolled] = React.useState(false);
  const [open, setOpen] = React.useState(false);

  React.useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 8);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <header
      className={cn(
        "sticky top-0 z-50 bg-white transition-shadow duration-200",
        scrolled ? "shadow-[0_1px_0_0_#E8EDF5,0_8px_24px_-12px_rgba(6,43,115,0.18)]" : "border-b border-[#EEF2F8]"
      )}
    >
      <div className="mx-auto flex h-[64px] w-full max-w-[1500px] items-center justify-between px-4 sm:px-6 lg:h-[92px] lg:px-8">
        {/* Brand */}
        <Link href="/#top" className="flex items-center gap-3">
          <span className="relative flex h-12 w-12 shrink-0 items-center justify-center overflow-hidden rounded-full bg-white shadow-md ring-1 ring-[#E3EAF4] lg:h-[52px] lg:w-[52px]">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={brandLogo.src}
              alt="Jeevan Sahay logo"
              className="h-full w-full object-contain"
            />
          </span>
          <span className="text-[19px] font-extrabold tracking-tight lg:text-xl">
            <span className="font-devanagari text-[#FF6A00]">जीवन</span>{" "}
            <span className="text-[#0B3D91]">Sahay</span>
          </span>
        </Link>

        {/* Center nav */}
        <nav aria-label="Primary" className="hidden items-center gap-8 lg:flex">
          {NAV.map((item) =>
            item.href.startsWith("/") ? (
              <Link
                key={item.label}
                href={item.href}
                className="group relative py-2 text-[14px] font-semibold text-[#33415C] transition-colors hover:text-[#062B73]"
              >
                {item.label}
                <span
                  className="absolute -bottom-0.5 left-1/2 h-[3px] w-0 -translate-x-1/2 rounded-full bg-[#F57C00] transition-all duration-200 group-hover:w-10"
                  aria-hidden
                />
              </Link>
            ) : (
              <a
                key={item.label}
                href={item.href}
                className={cn(
                  "group relative py-2 text-[14px] font-semibold transition-colors",
                  item.active ? "text-[#062B73]" : "text-[#33415C] hover:text-[#062B73]"
                )}
              >
                {item.label}
                <span
                  className={cn(
                    "absolute -bottom-0.5 left-1/2 h-[3px] -translate-x-1/2 rounded-full transition-all duration-200",
                    item.active
                      ? "w-10 bg-[#F57C00]"
                      : "w-0 bg-[#F57C00] group-hover:w-10"
                  )}
                  aria-hidden
                />
              </a>
            )
          )}
        </nav>

        {/* Right actions */}
        <div className="hidden items-center gap-2.5 lg:flex">
          <Link
            href="/login"
            className="inline-flex h-10 w-[72px] items-center justify-center rounded-lg border border-[#062B73] bg-white text-[13px] font-bold text-[#062B73] transition-all duration-150 hover:-translate-y-px hover:shadow-sm"
          >
            Sign In
          </Link>
          <Link
            href="/signup"
            className="inline-flex h-10 w-[72px] items-center justify-center rounded-lg bg-[#062B73] text-[13px] font-bold text-white shadow-[0_4px_10px_-3px_rgba(6,43,115,0.45)] transition-all duration-150 hover:-translate-y-px hover:bg-[#0B3D91] hover:shadow-lg"
          >
            Sign Up
          </Link>
        </div>

        {/* Mobile toggle */}
        <button
          type="button"
          onClick={() => setOpen((o) => !o)}
          aria-expanded={open}
          aria-controls="mobile-nav"
          aria-label="Toggle menu"
          className="rounded-lg p-2 text-[#062B73] transition-colors hover:bg-[#EAF3FF] lg:hidden"
        >
          {open ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
        </button>
      </div>

      {/* Mobile menu */}
      <div
        id="mobile-nav"
        className={cn(
          "overflow-hidden border-t border-[#EEF2F8] bg-white transition-all duration-300 lg:hidden",
          open ? "max-h-[420px] opacity-100" : "max-h-0 opacity-0"
        )}
      >
        <nav aria-label="Mobile" className="space-y-1 px-4 py-4">
          {NAV.map((item) =>
            item.href.startsWith("/") ? (
              <Link
                key={item.label}
                href={item.href}
                onClick={() => setOpen(false)}
                className="block rounded-lg px-3 py-2.5 text-[15px] font-semibold text-[#33415C] hover:bg-[#F5F8FC]"
              >
                {item.label}
              </Link>
            ) : (
              <a
                key={item.label}
                href={item.href}
                onClick={() => setOpen(false)}
                className={cn(
                  "block rounded-lg px-3 py-2.5 text-[15px] font-semibold",
                  item.active
                    ? "bg-[#EAF3FF] text-[#062B73]"
                    : "text-[#33415C] hover:bg-[#F5F8FC]"
                )}
              >
                {item.label}
              </a>
            )
          )}
          <div className="flex gap-2.5 pt-3">
            <Link
              href="/login"
              className="inline-flex h-10 flex-1 items-center justify-center rounded-lg border border-[#062B73] text-[13px] font-bold text-[#062B73]"
            >
              Sign In
            </Link>
            <Link
              href="/signup"
              className="inline-flex h-10 flex-1 items-center justify-center rounded-lg bg-[#062B73] text-[13px] font-bold text-white"
            >
              Sign Up
            </Link>
          </div>
        </nav>
      </div>
    </header>
  );
}
