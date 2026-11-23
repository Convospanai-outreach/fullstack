"use client";

import Link from "next/link";
import { useState, useRef, useEffect } from "react";
import { ChevronDown } from "lucide-react";
import { LogoMark } from "@/components/brand/LogoMark";
import { cleanNavGroups } from "@/lib/siteContent";
import navigation from "../../content/settings/navigation.json";
import { siteSans, siteSerif } from "@/components/marketing/home/fonts";

const NAV_GROUPS = cleanNavGroups(navigation);

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
        onClick={(event) => setOpen((value) => event.detail === 0 ? !value : true)}
        className="flex items-center gap-1 rounded-none px-3 py-2 text-sm font-semibold text-[#1A1414] transition hover:bg-[#5C1A2B]/[0.06] hover:text-[#5C1A2B]"
        aria-expanded={open}
      >
        {group.label}
        <ChevronDown
          className={`h-3.5 w-3.5 transition-transform duration-200 ${open ? "rotate-180" : ""}`}
        />
      </button>

      {open && (
        <div className="absolute left-0 top-full z-50 mt-1 w-80 before:absolute before:-top-1 before:left-0 before:h-1 before:w-full before:content-[''] rounded-[4px] border border-[#C2A36B]/60 bg-[#F3EDE4]/[0.85] p-2 shadow-[0_12px_32px_-8px_rgba(26,20,20,0.22)] backdrop-blur-[16px] animate-in fade-in zoom-in-95 duration-150">
          {group.items.map((item) => (
            <Link
              key={item.href + item.label}
              href={item.href}
              onClick={() => setOpen(false)}
              className="flex items-center justify-between rounded-xl px-4 py-2.5 text-sm font-medium text-[#1A1414] transition hover:bg-[#5C1A2B]/[0.06] hover:text-[#5C1A2B]"
            >
              {item.label}
              {"badge" in item && item.badge && (
                <span className="rounded-none bg-[#C2A36B]/40 px-2 py-0.5 text-[10px] font-bold uppercase tracking-widest text-[#1A1414]">
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
    <nav className={`fixed top-0 left-0 right-0 z-50 border-b border-[#C2A36B]/45 bg-[#F3EDE4]/[0.72] backdrop-blur-[16px] ${siteSans.className} ${siteSerif.variable}`}>
      <div className="mx-auto flex h-20 max-w-7xl items-center justify-between px-6">
        {/* Logo */}
        <Link href="/" className="group flex items-center gap-2">
          <LogoMark priority className="h-8 w-8" />
          <span className="text-lg font-semibold tracking-tight text-[#1A1414]">
            CraftMyFunnel AI
          </span>
        </Link>

        {/* Desktop nav */}
        <div className="hidden items-center gap-1 xl:flex">
          {NAV_GROUPS.map((group) => (
            <DropdownMenu key={group.label} group={group} />
          ))}
        </div>

        {/* Desktop CTAs */}
        <div className="hidden items-center gap-3 md:flex">
          <Link
            href="/pricing"
            className="rounded-none px-3 py-2 text-sm font-semibold text-[#1A1414] transition hover:bg-[#5C1A2B]/[0.06] hover:text-[#5C1A2B]"
          >
            Pricing
          </Link>
          <div className="h-5 w-px bg-[#5C1A2B]/15" />
          <Link
            href="/login"
            className="rounded-none border border-[#1A1414] px-5 py-2.5 text-[15px] font-medium text-[#1A1414] transition hover:bg-[#5C1A2B]/[0.06]"
          >
            Sign In
          </Link>
          <Link
            href="/signup"
            className="rounded-none bg-[#5C1A2B] px-5 py-2.5 text-[15px] font-semibold text-[#F3EDE4] transition hover:bg-[#46121F]"
          >
            Start free
          </Link>
        </div>

        {/* Mobile hamburger */}
        <button
          type="button"
          className="rounded-md p-2 text-[#1A1414] transition hover:bg-[#5C1A2B]/10 hover:text-[#5C1A2B] xl:hidden"
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
        <div className="max-h-[calc(100dvh-4.5rem)] overflow-y-auto border-t border-[#1A1414]/10 bg-white px-6 py-5 xl:hidden">
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
                    className="flex items-center gap-2 rounded-xl px-3 py-2.5 text-sm font-medium text-[#1A1414] transition hover:bg-[#5C1A2B]/[0.06] hover:text-[#5C1A2B]"
                  >
                    {item.label}
                    {"badge" in item && item.badge && (
                      <span className="rounded-none bg-[#C2A36B]/40 px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-widest text-[#1A1414]">
                        {item.badge}
                      </span>
                    )}
                  </Link>
                ))}
                <div className="my-2 h-px bg-[#5C1A2B]/10" />
              </div>
            ))}
            <div className="flex flex-col gap-3 pt-2">
              <Link
                href="/pricing"
                className="rounded-xl px-3 py-2.5 text-sm font-medium text-[#1A1414] transition hover:bg-[#5C1A2B]/[0.06] hover:text-[#5C1A2B]"
                onClick={() => setMobileOpen(false)}
              >
                Pricing
              </Link>
              <Link
                href="/login"
                className="rounded-none border border-[#1A1414] px-4 py-2.5 text-center text-sm font-medium text-[#1A1414]"
                onClick={() => setMobileOpen(false)}
              >
                Sign In
              </Link>
              <Link
                href="/signup"
                className="rounded-none bg-[#5C1A2B] px-4 py-2.5 text-center text-sm font-semibold text-[#F3EDE4]"
                onClick={() => setMobileOpen(false)}
              >
                Start free
              </Link>
            </div>
          </div>
        </div>
      )}
    </nav>
  );
}
