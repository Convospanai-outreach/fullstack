"use client";

import Link from "next/link";
import { useState, useRef, useEffect } from "react";
import { ChevronDown } from "lucide-react";
import { LogoMark } from "@/components/brand/LogoMark";

const NAV_GROUPS = [
  {
    label: "Product",
    items: [
      { label: "Fluid Funnel Engine", href: "/funnel", badge: "New" },
      { label: "Buyer Signals — NetJana", href: "/#platform" },
      { label: "AI Outreach — CMF Core", href: "/#workflow" },
      { label: "Human Layer", href: "/#workflow" },
      { label: "Covospan EDGE", href: "/#platform" },
    ],
  },
  {
    label: "Use Cases",
    items: [
      { label: "All Use Cases", href: "/use-cases" },
      { label: "Facility Management", href: "/use-cases/facility-management" },
      { label: "Security Services", href: "/use-cases/security-services" },
      { label: "Staffing & Recruiting", href: "/use-cases/staffing" },
      { label: "L&D / Training", href: "/use-cases/training" },
      { label: "Consulting & Advisory", href: "/use-cases/consulting" },
      { label: "Managed IT Services", href: "/use-cases/managed-services" },
    ],
  },
  {
    label: "Platform",
    items: [
      { label: "How it works", href: "/#dashboard-preview" },
      { label: "Pilot programme", href: "/#pilot" },
      { label: "Pricing", href: "/pricing", badge: "Popular" },
      { label: "About", href: "/about" },
      { label: "Regional Hubs", href: "/locations" },
    ],
  },
  {
    label: "Resources",
    items: [
      { label: "Blog", href: "/blog" },
      { label: "Help Center", href: "/help" },
      { label: "FAQ", href: "/faq" },
      { label: "Contact", href: "/contact" },
      { label: "Support", href: "/support" },
      { label: "Security", href: "/security" },
      { label: "Google API Disclosure", href: "/google-api-disclosure" },
    ],
  },
];

function DropdownMenu({
  group,
}: {
  group: (typeof NAV_GROUPS)[number];
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handler(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  return (
    <div
      ref={ref}
      className="relative"
      onMouseEnter={() => setOpen(true)}
      onMouseLeave={() => setOpen(false)}
    >
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex items-center gap-1 rounded-full px-3 py-2 text-sm font-semibold text-slate-300 transition hover:bg-white/[0.07] hover:text-white"
        aria-expanded={open}
      >
        {group.label}
        <ChevronDown
          className={`h-3.5 w-3.5 transition-transform duration-200 ${open ? "rotate-180" : ""}`}
        />
      </button>

      {open && (
        <div className="absolute left-0 top-full z-50 mt-1 w-64 rounded-2xl border border-white/10 bg-slate-950/95 p-2 shadow-2xl shadow-black/50 backdrop-blur-2xl animate-in fade-in zoom-in-95 duration-150">
          {group.items.map((item) => (
            <Link
              key={item.href + item.label}
              href={item.href}
              onClick={() => setOpen(false)}
              className="flex items-center justify-between rounded-xl px-4 py-2.5 text-sm font-medium text-slate-300 transition hover:bg-white/[0.07] hover:text-white"
            >
              {item.label}
              {"badge" in item && item.badge && (
                <span className="rounded-full bg-cyan-400/15 px-2 py-0.5 text-[10px] font-bold uppercase tracking-widest text-cyan-300">
                  {item.badge}
                </span>
              )}
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}

export function NavBar() {
  const [mobileOpen, setMobileOpen] = useState(false);

  return (
    <nav className="fixed top-0 left-0 right-0 z-50 border-b border-white/10 bg-slate-950/70 backdrop-blur-xl">
      <div className="mx-auto flex max-w-7xl items-center justify-between px-6 py-4">
        {/* Logo */}
        <Link href="/" className="group flex items-center gap-2">
          <LogoMark priority className="h-8 w-8" />
          <span className="bg-gradient-to-r from-white to-slate-300 bg-clip-text text-lg font-bold text-transparent">
            CraftMyFunnel AI
          </span>
        </Link>

        {/* Desktop nav */}
        <div className="hidden items-center gap-1 lg:flex">
          {NAV_GROUPS.map((group) => (
            <DropdownMenu key={group.label} group={group} />
          ))}
        </div>

        {/* Desktop CTAs */}
        <div className="hidden items-center gap-3 md:flex">
          <div className="h-5 w-px bg-white/15" />
          <Link
            href="/login"
            className="rounded-full border border-white/15 px-4 py-2 text-sm font-medium text-white transition hover:border-white/40"
          >
            Sign In
          </Link>
          <Link
            href="/signup"
            className="group relative rounded-full bg-gradient-to-r from-indigo-500 to-cyan-500 px-4 py-2 text-sm font-semibold text-white shadow-lg shadow-indigo-500/25 transition hover:brightness-110"
          >
            <span className="absolute inset-0 rounded-full bg-cyan-400 blur-md opacity-40 animate-pulse group-hover:opacity-75 transition-opacity" />
            <span className="relative z-10">Get Started</span>
          </Link>
        </div>

        {/* Mobile hamburger */}
        <button
          type="button"
          className="rounded-md p-2 text-slate-300 transition hover:bg-white/10 hover:text-white lg:hidden"
          aria-label={mobileOpen ? "Close menu" : "Open menu"}
          onClick={() => setMobileOpen((v) => !v)}
        >
          {mobileOpen ? (
            <svg viewBox="0 0 24 24" className="h-6 w-6" fill="none" stroke="currentColor" strokeWidth="1.5">
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          ) : (
            <svg viewBox="0 0 24 24" className="h-6 w-6" fill="none" stroke="currentColor" strokeWidth="1.5">
              <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 6.75h16.5M3.75 12h16.5m-16.5 5.25h16.5" />
            </svg>
          )}
        </button>
      </div>

      {/* Mobile drawer */}
      {mobileOpen && (
        <div className="border-t border-white/10 bg-slate-950/95 px-6 py-5 lg:hidden">
          <div className="flex flex-col gap-1">
            {NAV_GROUPS.map((group) => (
              <div key={group.label}>
                <p className="mb-1 px-2 text-[10px] font-bold uppercase tracking-[0.22em] text-slate-500">
                  {group.label}
                </p>
                {group.items.map((item) => (
                  <Link
                    key={item.href + item.label}
                    href={item.href}
                    onClick={() => setMobileOpen(false)}
                    className="flex items-center gap-2 rounded-xl px-3 py-2.5 text-sm font-medium text-slate-300 transition hover:bg-white/[0.06] hover:text-white"
                  >
                    {item.label}
                    {"badge" in item && item.badge && (
                      <span className="rounded-full bg-cyan-400/15 px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-widest text-cyan-300">
                        {item.badge}
                      </span>
                    )}
                  </Link>
                ))}
                <div className="my-2 h-px bg-white/5" />
              </div>
            ))}
            <div className="flex flex-col gap-3 pt-2">
              <Link
                href="/login"
                className="rounded-full border border-white/15 px-4 py-2.5 text-center text-sm font-medium text-white"
                onClick={() => setMobileOpen(false)}
              >
                Sign In
              </Link>
              <Link
                href="/signup"
                className="group relative rounded-full bg-gradient-to-r from-indigo-500 to-cyan-500 px-4 py-2.5 text-center text-sm font-semibold text-white"
                onClick={() => setMobileOpen(false)}
              >
                <span className="absolute inset-0 rounded-full bg-cyan-400 blur-md opacity-40 animate-pulse group-hover:opacity-75 transition-opacity" />
                <span className="relative z-10">Get Started</span>
              </Link>
            </div>
          </div>
        </div>
      )}
    </nav>
  );
}
