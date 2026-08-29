"use client";

/*
 * DashboardSidebar.tsx — Redesigned sidebar
 *
 * Changes from previous version:
 * - Width reduced: w-64 (256px) → w-48 (192px), matching Linear/Vercel proportions
 * - Added workspace switcher between logo and nav (Vercel pattern)
 * - Restructured nav groups per new information architecture
 * - Identity consolidated to single row at footer — single source of truth
 * - Plan badge in identity row instead of separate progress bar (removed)
 * - Section labels: 10px/uppercase/weight-500/text-white/20
 * - Nav items: 12.5px/weight-400, 32px height, Lucide 14px icons
 * - Active: bg-blue-500/12 text-blue-400 | Hover: bg-white/4 text-white/70
 * - CRM Bridge hidden when PRODUCT_FLAGS.emailFirstBeta is true
 */

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useUser } from "@clerk/nextjs";
import useSWR from "swr";
import {
  LayoutDashboard,
  Megaphone,
  Activity,
  Settings,
  CreditCard,
  BarChart2,
  ShieldCheck,
  MoreHorizontal,
  Users,
  Wrench,
  X,
  GitBranch,
  Calendar,
  FileText,
  Target,
  Layout,
  Zap,
  Lock,
  Gauge,
  ClipboardList,
  Building2,
  UploadCloud,
  AtSign,
  Linkedin,
  Phone,
  MessageCircle,
  BookOpen,
  Workflow,
  Store,
} from "lucide-react";
import { LogoMark } from "@/components/brand/LogoMark";
import { WorkspaceSwitcher } from "@/components/dashboard/WorkspaceSwitcher";
import { HIDDEN_FEATURES, PRODUCT_FLAGS, type HiddenFeatureKey } from "@/lib/productFlags";

const fetcher = (url: string) => fetch(url).then((res) => res.json());

interface NavItem {
  href: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  badge?: number;
}

interface NavGroup {
  label?: string;
  items: NavItem[];
}

type ToolStatus = { key: HiddenFeatureKey; built: boolean; enabled: boolean };

// Icons/labels for HIDDEN_FEATURES keys that get promoted into the main funnel
// groups below, once live (built + enabled), instead of only living behind /tools.
const PROMOTED_FEATURE_ICONS: Partial<Record<HiddenFeatureKey, React.ComponentType<{ className?: string }>>> = {
  "csv-ingestion": UploadCloud,
  "hunter-email-finder": AtSign,
  "linkedin-runner": Linkedin,
  "caller": Phone,
  "whatsapp": MessageCircle,
  "playbooks": BookOpen,
  "workflows": Workflow,
  "marketplace": Store,
};

// Keys with no place on the funnel spine — they stay behind /tools only.
const TOOLS_ONLY_FEATURE_KEYS: HiddenFeatureKey[] = [
  "agents",
  "command-center",
  "edge",
  "jobs",
  "knowledge",
  "runtime",
  "scraper-bridge",
  "sovereign",
  "studio",
];

function promotedItem(key: HiddenFeatureKey, liveKeys: Set<HiddenFeatureKey>): NavItem | null {
  if (!liveKeys.has(key)) return null;
  const feature = HIDDEN_FEATURES[key];
  const Icon = PROMOTED_FEATURE_ICONS[key];
  if (!feature || !Icon) return null;
  return { href: feature.openPath, label: feature.label, icon: Icon };
}

// Nav grouped by what the user is trying to accomplish (mirrors the lead
// funnel: COLD -> WARM -> HOT -> COORDINATING -> MEETING_CONFIRMED -> CLOSED_*
// from lib/crm/leadStageTransitions.ts), not by feature area. Items with no
// funnel stage (settings/ops) live in their own group at the bottom, out of
// the goal-oriented groups. `liveKeys` are HIDDEN_FEATURES keys that are both
// built and enabled for this workspace — see /api/settings/hidden-features.
const buildNavGroups = (liveKeys: Set<HiddenFeatureKey>, approvalsBadge: number): NavGroup[] => {
  const settings: NavItem[] = [
    { href: '/team', label: 'Team', icon: Building2 },
    { href: '/billing', label: 'Billing', icon: CreditCard },
  ];

  // CRM sync — hidden when emailFirstBeta is true
  if (!PRODUCT_FLAGS.emailFirstBeta) {
    settings.push({ href: '/crm', label: 'CRM Bridge', icon: Activity });
  }

  settings.push(
    { href: '/settings', label: 'Settings', icon: Settings },
    { href: '/admin', label: 'Admin', icon: Lock },
    { href: '/monitoring', label: 'Monitoring', icon: Gauge },
  );

  for (const key of TOOLS_ONLY_FEATURE_KEYS) {
    const feature = HIDDEN_FEATURES[key];
    if (feature && liveKeys.has(key)) {
      settings.push({ href: feature.openPath, label: feature.label, icon: Wrench });
    }
  }

  return [
    {
      items: [
        { href: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
      ],
    },
    {
      label: 'Build my list',
      items: [
        { href: '/leads', label: 'Leads', icon: Users },
        { href: '/icp-builder', label: 'ICP Builder', icon: Target },
        { href: '/templates', label: 'Templates', icon: FileText },
        { href: '/landing-agent/new', label: 'Landing Pages', icon: Layout },
        promotedItem('csv-ingestion', liveKeys),
        promotedItem('hunter-email-finder', liveKeys),
      ].filter((item): item is NavItem => item !== null),
    },
    {
      label: 'Reach out',
      items: [
        { href: '/campaigns', label: 'Campaigns', icon: Megaphone },
        { href: '/automations', label: 'Automations', icon: Zap },
        promotedItem('workflows', liveKeys),
        promotedItem('linkedin-runner', liveKeys),
        promotedItem('caller', liveKeys),
        promotedItem('whatsapp', liveKeys),
        promotedItem('playbooks', liveKeys),
      ].filter((item): item is NavItem => item !== null),
    },
    {
      label: 'Work my replies',
      items: [
        { href: '/pipeline', label: 'Pipeline', icon: GitBranch },
        { href: '/calendar', label: 'Calendar', icon: Calendar },
        { href: '/approvals', label: 'Approvals & Inbox', icon: ShieldCheck, badge: approvalsBadge },
        { href: '/intel', label: 'Intel', icon: Activity },
      ],
    },
    {
      label: 'Close & measure',
      items: [
        { href: '/analytics/roi', label: 'Analytics', icon: BarChart2 },
        { href: '/governance', label: 'Governance', icon: ShieldCheck },
        { href: '/audit-logs', label: 'Audit Logs', icon: ClipboardList },
        promotedItem('marketplace', liveKeys),
      ].filter((item): item is NavItem => item !== null),
    },
    {
      label: 'Settings',
      items: settings,
    },
  ];
};

const TOOLS_LINK_COUNT = TOOLS_ONLY_FEATURE_KEYS.length;

interface DashboardSidebarProps {
  isOpen: boolean;
  onClose: () => void;
}

export function DashboardSidebar({ isOpen, onClose }: DashboardSidebarProps) {
  const pathname = usePathname();
  const { user } = useUser();

  const { data: approvals } = useSWR<{ requests: unknown[] }>("/api/approvals", fetcher, { refreshInterval: 30000 });
  const pendingActionCount = approvals?.requests?.length ?? 0;
  const { data: toolsData } = useSWR<{ features: ToolStatus[] }>("/api/settings/hidden-features", fetcher);
  const liveFeatureKeys = new Set<HiddenFeatureKey>(
    (toolsData?.features ?? []).filter((f) => f.built && f.enabled).map((f) => f.key)
  );
  const navGroups = buildNavGroups(liveFeatureKeys, pendingActionCount);
  const userName = user?.fullName ?? user?.firstName ?? 'User';
  const userInitials = userName
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((n) => n[0])
    .join('')
    .toUpperCase() || 'U';

  // Org name from Clerk org, or fallback

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

        {/* Nav groups */}
        <nav className="flex-1 overflow-y-auto px-2 pb-2">
          {navGroups.map((group, gi) => (
            <div key={gi} className={gi > 0 ? 'mt-1' : ''}>
              {group.label && (
                <div className="pt-4 pb-1 px-2">
                  <span className="text-[10px] uppercase font-medium tracking-wide text-muted-foreground">
                    {group.label}
                  </span>
                </div>
              )}
              <div className="space-y-0.5">
                {group.items.map((item) => {
                  const Icon = item.icon;
                  const isActive =
                    pathname === item.href || pathname?.startsWith(`${item.href}/`);

                  return (
                    <Link
                      key={item.href}
                      href={item.href}
                      onClick={onClose}
                      className={`
                        flex items-center gap-2 px-2 py-[5px] rounded-md text-[12.5px] font-normal
                        transition-colors duration-150
                        ${isActive
                          ? 'bg-primary/10 text-primary'
                          : 'text-muted-foreground hover:bg-accent hover:text-accent-foreground'
                        }
                      `}
                    >
                      <Icon className="w-[14px] h-[14px] flex-shrink-0" />
                      <span className="flex-1">{item.label}</span>
                      {!!item.badge && item.badge > 0 && (
                        <span className="text-[9.5px] border border-border rounded px-1 text-muted-foreground">
                          {item.badge}
                        </span>
                      )}
                    </Link>
                  );
                })}
              </div>
            </div>
          ))}

          {/* Tools — discovery surface for the remaining feature areas with no funnel-stage home */}
          <div className="mt-1 pt-4 border-t border-border">
            <Link
              href="/tools"
              onClick={onClose}
              className={`
                flex items-center gap-2 px-2 py-[5px] rounded-md text-[12.5px] font-normal
                transition-colors duration-150
                ${pathname?.startsWith('/tools')
                  ? 'bg-blue-500/12 text-blue-400'
                  : 'text-white/45 hover:bg-white/4 hover:text-white/70'
                }
              `}
            >
              <Wrench className="w-[14px] h-[14px] flex-shrink-0" />
              <span className="flex-1">Tools</span>
              <span className="text-[9.5px] text-muted-foreground">{TOOLS_LINK_COUNT}</span>
            </Link>
          </div>
        </nav>

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
