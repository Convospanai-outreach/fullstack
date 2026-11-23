"use client";

/*
 * DashboardSidebar.tsx — Redesigned sidebar
 *
 * Changes from previous version:
 * - Width reduced: w-64 (256px) → w-48 (192px), matching Linear/Vercel proportions
 * - Added workspace switcher between logo and nav (Vercel pattern)
 * - One entry per concept (lib/navSections.ts): Home, Inbox, Leads, Campaigns, Pipeline,
 *   Content, Reports, then Settings. Each section's pages are tabs (SectionTabs), not entries.
 * - Admin console only for platform admins (the role /admin itself requires)
 * - Labs (flagged/beta tools) live in the Tools hub and ⌘K, not the sidebar
 * - Identity consolidated to single row at footer — single source of truth
 * - Nav items: 12.5px/weight-400, 32px height, Lucide 14px icons
 */

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useSession } from "next-auth/react";
import useSWR from "swr";
import {
  Inbox,
  LayoutDashboard,
  Megaphone,
  Settings,
  BarChart2,
  MoreHorizontal,
  Users,
  X,
  GitBranch,
  FileText,
  Lock,
} from "lucide-react";
import { LogoMark } from "@/components/brand/LogoMark";
import { WorkspaceSwitcher } from "@/components/dashboard/WorkspaceSwitcher";
import { EdgeStatusPlate } from "@/components/dashboard/EdgeStatusPlate";
import { PRODUCT_FLAGS } from "@/lib/productFlags";
import { NAV_SECTIONS, SETTINGS_PREFIXES, isLinkActive, matchesPath } from "@/lib/navSections";

const fetcher = (url: string) => fetch(url).then((res) => res.json());

const SECTION_ICONS: Record<string, React.ComponentType<{ className?: string }>> = {
  home: LayoutDashboard,
  inbox: Inbox,
  leads: Users,
  campaigns: Megaphone,
  pipeline: GitBranch,
  content: FileText,
  reports: BarChart2,
};

// Same roles app/(dashboard)/admin/page.tsx requires.
const PLATFORM_ADMIN_ROLES = ["SUPER_ADMIN", "SYSTEM_ADMIN"];

interface DashboardSidebarProps {
  isOpen: boolean;
  onClose: () => void;
}

function NavEntry({
  href,
  label,
  icon: Icon,
  active,
  badge,
  onClick,
}: {
  href: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  active: boolean;
  badge?: number | undefined;
  onClick: () => void;
}) {
  return (
    <Link
      href={href}
      onClick={onClick}
      aria-current={active ? "page" : undefined}
      className={`
        flex items-center gap-2.5 px-2.5 py-2 rounded-[3px] text-[14px] font-normal
        transition-colors duration-150
        ${active
          ? 'bg-sidebar-active text-sidebar-foreground shadow-[inset_2px_0_0_#C2A36B]'
          : 'text-sidebar-muted hover:bg-sidebar-active hover:text-sidebar-foreground'
        }
      `}
    >
      <Icon className={`w-4 h-4 flex-shrink-0 ${active ? 'text-[#C2A36B]' : ''}`} />
      <span className="flex-1">{label}</span>
      {!!badge && badge > 0 && (
        <span className="text-[10px] border border-sidebar-foreground/30 rounded-[2px] px-1 text-sidebar-muted">
          {badge}
        </span>
      )}
    </Link>
  );
}

export function DashboardSidebar({ isOpen, onClose }: DashboardSidebarProps) {
  const pathname = usePathname() ?? '';
  const { data: session } = useSession();

  const { data: approvals } = useSWR<{ requests: unknown[] }>("/api/approvals", fetcher, { refreshInterval: 30000 });
  const { data: inboxCounts } = useSWR<{ unreadReplies?: number }>("/api/proxy/inbox/counts", fetcher, { refreshInterval: 60000 });
  // One combined badge: unread replies plus approvals waiting on you (both live in Inbox).
  const inboxBadge = (inboxCounts?.unreadReplies ?? 0) + (approvals?.requests?.length ?? 0);

  const isPlatformAdmin = PLATFORM_ADMIN_ROLES.includes(session?.user?.enterpriseRole ?? '');
  const userName = session?.user?.name ?? 'User';
  const userInitials = userName
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((n) => n[0])
    .join('')
    .toUpperCase() || 'U';

  const planLabel = PRODUCT_FLAGS.emailFirstBeta ? 'Enterprise' : 'Pro plan';

  return (
    <>
      {/* Mobile backdrop */}
      {isOpen && (
        <div
          className="fixed inset-0 bg-[rgba(26,20,20,.6)] backdrop-blur-[4px] z-40 lg:hidden"
          onClick={onClose}
          aria-hidden="true"
        />
      )}

      <aside
        className={`
          w-[232px] fixed left-0 top-0 bottom-0 bg-[image:var(--sidebar-bg)] text-sidebar-foreground border-r border-sidebar-border shadow-[4px_0_24px_-8px_rgba(26,4,10,.45)] isolate z-50 flex flex-col
          transition-transform duration-300 ease-in-out
          lg:translate-x-0
          ${isOpen ? 'translate-x-0' : '-translate-x-full'}
        `}
        role="navigation"
        aria-label="Main navigation"
      >
        {/* Gold glow, top-left */}
        <div aria-hidden className="pointer-events-none absolute inset-0 -z-10 bg-[radial-gradient(60%_40%_at_0%_0%,rgba(194,163,107,.20),transparent_70%)]" />
        {/* Logo row */}
        <div className="flex items-center justify-between px-4 pt-4 pb-4">
          <Link href="/dashboard" className="flex items-center gap-2">
            <LogoMark className="h-[26px] w-[26px]" />
            <span className="text-[20px] font-semibold text-sidebar-foreground font-display">CraftMyFunnel</span>
          </Link>
          {/* Mobile close */}
          <button
            onClick={onClose}
            className="lg:hidden p-1 rounded hover:bg-sidebar-foreground/10 text-sidebar-foreground/75 hover:text-sidebar-foreground transition-colors"
            aria-label="Close sidebar"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Workspace switcher */}
        <div className="px-3 mb-[18px]">
          <WorkspaceSwitcher />
        </div>
        <p className="mx-5 mb-1.5 text-[10px] font-semibold uppercase tracking-[0.12em] text-sidebar-label">Workspace</p>

        {/* Sections */}
        <nav className="flex-1 overflow-y-auto px-3 pb-2 space-y-0.5">
          {NAV_SECTIONS.map((section) => (
            <NavEntry
              key={section.key}
              href={section.tabs[0]!.href}
              label={section.label}
              icon={SECTION_ICONS[section.key] ?? LayoutDashboard}
              active={section.tabs.some((tab) => isLinkActive(tab, pathname))}
              badge={section.key === 'inbox' ? inboxBadge : undefined}
              onClick={onClose}
            />
          ))}
        </nav>

        <div className="px-3 pb-2 space-y-0.5">
          <EdgeStatusPlate onClick={onClose} />
          <NavEntry
            href="/settings"
            label="Settings"
            icon={Settings}
            active={SETTINGS_PREFIXES.some((prefix) => matchesPath(prefix, pathname))}
            onClick={onClose}
          />
          {isPlatformAdmin && (
            <div className="rounded-md border border-dashed border-warning/40">
              <NavEntry
                href="/admin"
                label="Admin console"
                icon={Lock}
                active={matchesPath('/admin', pathname) || matchesPath('/superadmin', pathname)}
                onClick={onClose}
              />
            </div>
          )}
        </div>

        {/* User identity row — single source of truth. Links to /profile, which
            previously had no way to be reached from the dashboard chrome at all. */}
        <div className="border-t border-sidebar-border/70 mx-3 px-1.5 pt-3 pb-3">
          <Link href="/profile" onClick={onClose} className="flex items-center gap-2 group">
            <div className="w-7 h-7 rounded-full bg-[#3A0E1A] ring-[1.5px] ring-[#C2A36B] text-sidebar-foreground flex items-center justify-center text-[11px] font-medium flex-shrink-0">
              {userInitials}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-[12px] font-medium text-sidebar-foreground truncate leading-none">{userName}</p>
              <p className="text-[11px] text-sidebar-muted mt-0.5 leading-none">{planLabel}</p>
            </div>
            <MoreHorizontal className="w-3.5 h-3.5 text-sidebar-foreground/75 flex-shrink-0" />
          </Link>
        </div>
      </aside>
    </>
  );
}
