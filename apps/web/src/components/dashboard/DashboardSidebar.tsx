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
        flex items-center gap-2 px-2 py-[5px] rounded-md text-[12.5px] font-normal
        transition-colors duration-150
        ${active
          ? 'bg-primary/10 text-primary'
          : 'text-muted-foreground hover:bg-accent hover:text-accent-foreground'
        }
      `}
    >
      <Icon className="w-[14px] h-[14px] flex-shrink-0" />
      <span className="flex-1">{label}</span>
      {!!badge && badge > 0 && (
        <span className="text-[9.5px] border border-border rounded px-1 text-muted-foreground">
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

  const planLabel = PRODUCT_FLAGS.emailFirstBeta ? 'Enterprise · Beta' : 'Pro plan';

  return (
    <>
      {/* Mobile backdrop */}
      {isOpen && (
        <div
          className="fixed inset-0 bg-black/60 backdrop-blur-sm z-40 lg:hidden"
          onClick={onClose}
          aria-hidden="true"
        />
      )}

      <aside
        className={`
          w-48 fixed left-0 top-0 bottom-0 bg-card border-r border-border z-50 flex flex-col
          transition-transform duration-300 ease-in-out
          lg:translate-x-0
          ${isOpen ? 'translate-x-0' : '-translate-x-full'}
        `}
        role="navigation"
        aria-label="Main navigation"
      >
        {/* Logo row */}
        <div className="flex items-center justify-between px-3 pt-4 pb-3">
          <Link href="/dashboard" className="flex items-center gap-2">
            <LogoMark className="h-[26px] w-[26px]" />
            <span className="text-[13px] font-medium text-foreground font-outfit">CraftMyFunnel</span>
          </Link>
          {/* Mobile close */}
          <button
            onClick={onClose}
            className="lg:hidden p-1 rounded hover:bg-accent text-muted-foreground hover:text-foreground transition-colors"
            aria-label="Close sidebar"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Workspace switcher */}
        <div className="px-2 mb-3">
          <WorkspaceSwitcher />
        </div>

        {/* Sections */}
        <nav className="flex-1 overflow-y-auto px-2 pb-2 space-y-0.5">
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

        <div className="px-2 pb-2 space-y-0.5">
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
        <div className="border-t border-border px-2 py-3">
          <Link href="/profile" onClick={onClose} className="flex items-center gap-2 group">
            <div className="w-6 h-6 rounded-full bg-primary/10 text-primary flex items-center justify-center text-[10px] font-medium flex-shrink-0">
              {userInitials}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-[12px] font-medium text-foreground truncate leading-none group-hover:text-primary transition-colors">{userName}</p>
              <p className="text-[10px] text-muted-foreground mt-0.5 leading-none">{planLabel}</p>
            </div>
            <MoreHorizontal className="w-3.5 h-3.5 text-muted-foreground group-hover:text-foreground transition-colors flex-shrink-0" />
          </Link>
        </div>
      </aside>
    </>
  );
}
