"use client";

/*
 * DashboardHeader.tsx — Redesigned header
 *
 * Changes from previous version:
 * - Removed: user identity widget (avatar, name, plan badge) — lives in sidebar footer
 * - Removed: bannerOffset prop — setup banner is now inline in page content, not fixed
 * - Removed: Ask AI button, QuickActions, separate identity widget
 * - Added: Single search trigger (⌘K → Omnibox) — replaces dual search surfaces
 * - Four items: ⌘K search, connection status dropdown (always visible), notification bell,
 *   one Help menu (page guide, help center, Labs)
 * - Removed: Tools menu (Labs lives in the Help menu and ⌘K) and the static "Manual mode"
 *   badge, which had no mode source behind it
 * - Kept: Mobile hamburger
 * - Height: h-12 (48px), border-b border-border
 */

import { Menu, Search } from "lucide-react";
import { NotificationBell } from "@/components/ui/NotificationBell";
import { ConnectionStatusBar } from "@/components/system/ConnectionStatusBar";
import { EdgeStatusChip } from "@/components/dashboard/EdgeStatusChip";
import { ThemeToggle } from "@/components/dashboard/ThemeToggle";
import { WorkspaceHelpPanel } from "@/components/dashboard/WorkspaceHelpPanel";

interface DashboardHeaderProps {
  onToggleSidebar: () => void;
}

export function DashboardHeader({ onToggleSidebar }: DashboardHeaderProps) {
  return (
    <header className="fixed top-0 left-0 lg:left-[232px] right-0 h-[51px] border-b border-border z-40 flex items-center gap-3.5 px-7 bg-[var(--header-bg)] backdrop-blur-[16px]">
      {/* Left: mobile hamburger */}
      <button
        onClick={onToggleSidebar}
        className="lg:hidden p-1.5 rounded-md hover:bg-accent text-muted-foreground hover:text-foreground transition-colors"
        aria-label="Toggle sidebar"
      >
        <Menu className="w-4 h-4" />
      </button>

      {/* Center: single search trigger */}
      <button
        className="glass flex items-center gap-2 px-3 h-9 rounded-[3px] text-[13px] text-muted-foreground
                   focus-visible:ring-2 focus-visible:ring-ring transition-colors flex-1 max-w-[300px]"
        onClick={() => {
          // Open the Omnibox — uses the same ⌘K shortcut mechanism
          window.dispatchEvent(new KeyboardEvent('keydown', { key: 'k', metaKey: true, bubbles: true }));
        }}
        aria-label="Search leads, campaigns… (⌘K)"
      >
        <Search className="w-3.5 h-3.5 flex-shrink-0" />
        <span className="flex-1 text-left truncate">Search leads, campaigns…</span>
        <kbd className="ml-auto text-[11px] border border-border rounded-[3px] px-1.5 hidden sm:inline">⌘K</kbd>
      </button>

      {/* Right zone: status dropdown + theme toggle + bell + help */}
      <div className="ml-auto flex items-center gap-2">
        <EdgeStatusChip />
        <ConnectionStatusBar inline />
        <ThemeToggle />

        <NotificationBell />

        {/* Page guide, help center, Labs and theme */}
        <WorkspaceHelpPanel />
      </div>
    </header>
  );
}
