"use client";

/*
 * DashboardHeader.tsx — Redesigned header
 *
 * Changes from previous version:
 * - Removed: user identity widget (avatar, name, plan badge) — lives in sidebar footer
 * - Removed: bannerOffset prop — setup banner is now inline in page content, not fixed
 * - Removed: Ask AI button, QuickActions, separate identity widget
 * - Added: Mode badge ("Manual mode") with pulse indicator
 * - Added: Single search trigger (⌘K → Omnibox) — replaces dual search surfaces
 * - Kept: Mobile hamburger, notification bell, help icon
 * - Height: h-12 (48px), border-b border-white/6
 */

import { Menu, Search, Bell, HelpCircle } from "lucide-react";
import { NotificationBell } from "@/components/ui/NotificationBell";
import Link from "next/link";

interface DashboardHeaderProps {
  onToggleSidebar: () => void;
}

export function DashboardHeader({ onToggleSidebar }: DashboardHeaderProps) {
  return (
    <header className="fixed top-0 left-0 lg:left-48 right-0 h-12 border-b border-white/6 z-40 flex items-center gap-3 px-5 bg-surface-app/90 backdrop-blur-md">
      {/* Left: mobile hamburger */}
      <button
        onClick={onToggleSidebar}
        className="lg:hidden p-1.5 rounded-md hover:bg-white/5 text-white/40 hover:text-white/70 transition-colors"
        aria-label="Toggle sidebar"
      >
        <Menu className="w-4 h-4" />
      </button>

      {/* Center: single search trigger */}
      <button
        className="flex items-center gap-2 px-3 h-8 rounded-md text-xs text-white/25
                   bg-white/4 border border-white/7 hover:bg-white/6 transition-colors flex-1 max-w-64"
        onClick={() => {
          // Open the Omnibox — uses the same ⌘K shortcut mechanism
          window.dispatchEvent(new KeyboardEvent('keydown', { key: 'k', metaKey: true, bubbles: true }));
        }}
        aria-label="Search leads, campaigns… (⌘K)"
      >
        <Search className="w-3.5 h-3.5 flex-shrink-0" />
        <span className="flex-1 text-left">Search leads, campaigns…</span>
        <kbd className="ml-auto text-[10px] bg-white/6 rounded px-1.5">⌘K</kbd>
      </button>

      {/* Right zone: mode badge + bell + help */}
      <div className="ml-auto flex items-center gap-2">
        {/* Mode badge */}
        <div className="flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium
                        text-emerald-400 bg-emerald-500/8 border border-emerald-500/18">
          <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
          Manual mode
        </div>

        {/* Notification bell */}
        <NotificationBell />

        {/* Help */}
        <Link
          href="/help"
          className="p-1.5 rounded-md text-white/30 hover:text-white/60 hover:bg-white/5 transition-colors"
          aria-label="Help"
        >
          <HelpCircle className="w-4 h-4" />
        </Link>
      </div>
    </header>
  );
}
