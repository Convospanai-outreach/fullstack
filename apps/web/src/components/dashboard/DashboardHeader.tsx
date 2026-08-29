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
 * - Height: h-12 (48px), border-b border-border
 */

import { Menu, Search, HelpCircle } from "lucide-react";
import { NotificationBell } from "@/components/ui/NotificationBell";
import { ConnectionStatusBar } from "@/components/system/ConnectionStatusBar";
import { ToolsMenu } from "@/components/dashboard/ToolsMenu";
import { WorkspaceHelpPanel } from "@/components/dashboard/WorkspaceHelpPanel";
import { ThemeToggle } from "@/components/dashboard/ThemeToggle";
import Link from "next/link";

interface DashboardHeaderProps {
  onToggleSidebar: () => void;
}

export function DashboardHeader({ onToggleSidebar }: DashboardHeaderProps) {
  return (
    <header className="fixed top-0 left-0 lg:left-48 right-0 h-12 border-b border-border z-40 flex items-center gap-3 px-5 bg-background/90 backdrop-blur-md">
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
        className="flex items-center gap-2 px-3 h-8 rounded-md text-xs text-muted-foreground
                   bg-muted border border-border hover:bg-accent transition-colors flex-1 max-w-64"
        onClick={() => {
          // Open the Omnibox — uses the same ⌘K shortcut mechanism
          window.dispatchEvent(new KeyboardEvent('keydown', { key: 'k', metaKey: true, bubbles: true }));
        }}
        aria-label="Search leads, campaigns… (⌘K)"
      >
        <Search className="w-3.5 h-3.5 flex-shrink-0" />
        <span className="flex-1 text-left truncate">Search leads, campaigns…</span>
        <kbd className="ml-auto text-[10px] bg-muted rounded px-1.5 hidden sm:inline">⌘K</kbd>
      </button>

      {/* Right zone: status pill + mode badge + bell + help */}
      <div className="ml-auto flex items-center gap-2">
        {/* Docked Connection Status */}
        <ConnectionStatusBar inline />

        {/* Tools discovery menu — grouped/gated feature surfaces */}
        <ToolsMenu />

        {/* Contextual "what is this page" guide */}
        <WorkspaceHelpPanel />

        {/* Mode badge */}
        <div className="hidden md:flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium
                        text-success bg-success/8 border border-success/18">
          <span className="w-1.5 h-1.5 rounded-full bg-success animate-pulse" />
          Manual mode
        </div>

        {/* Theme toggle */}
        <ThemeToggle />

        {/* Notification bell */}
        <NotificationBell />

        {/* Help */}
        <Link
          href="/help"
          className="p-1.5 rounded-md text-muted-foreground hover:text-foreground hover:bg-accent transition-colors"
          aria-label="Help"
        >
          <HelpCircle className="w-4 h-4" />
        </Link>
      </div>
    </header>
  );
}
