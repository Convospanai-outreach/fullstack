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
import {
  LayoutDashboard,
  Megaphone,
  Inbox,
  Activity,
  Bot,
  Settings,
  CreditCard,
  BarChart2,
  ShieldCheck,
  ChevronDown,
  MoreHorizontal,
  Users,
  Wrench,
  X,
} from "lucide-react";
import { LogoMark } from "@/components/brand/LogoMark";
import { HIDDEN_FEATURES, PRODUCT_FLAGS } from "@/lib/productFlags";

interface NavItem {
  href: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
}

interface NavGroup {
  label?: string;
  items: NavItem[];
}

// Build nav groups; filter CRM Bridge when emailFirstBeta is true (per existing logic)
const buildNavGroups = (): NavGroup[] => {
  const account: NavItem[] = [
    { href: '/billing', label: 'Billing', icon: CreditCard },
  ];

  // CRM sync — hidden when emailFirstBeta is true
  if (!PRODUCT_FLAGS.emailFirstBeta) {
    account.push({ href: '/crm', label: 'CRM Bridge', icon: Activity });
  }

  account.push({ href: '/settings', label: 'Settings', icon: Settings });

  return [
    {
      items: [
        { href: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
        { href: '/approvals', label: 'Approvals', icon: ShieldCheck },
        { href: '/leads', label: 'Leads', icon: Users },
        { href: '/campaigns', label: 'Campaigns', icon: Megaphone },
        { href: '/inbox', label: 'Inbox', icon: Inbox },
      ],
    },
    {
      label: 'Analyze',
      items: [
        { href: '/intel', label: 'Intel', icon: Activity },
        { href: '/analytics/roi', label: 'Campaign ROI', icon: BarChart2 },
        { href: '/governance', label: 'Governance', icon: ShieldCheck },
      ],
    },
    {
      label: 'Account',
      items: account,
    },
  ];
};

const HIDDEN_FEATURE_COUNT = Object.keys(HIDDEN_FEATURES).length;

interface DashboardSidebarProps {
  isOpen: boolean;
  onClose: () => void;
}

export function DashboardSidebar({ isOpen, onClose }: DashboardSidebarProps) {
  const pathname = usePathname();
  const { user } = useUser();

  const navGroups = buildNavGroups();
  const userName = user?.fullName ?? user?.firstName ?? 'User';
  const userInitials = userName
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((n) => n[0])
    .join('')
    .toUpperCase() || 'U';

  // Org name from Clerk org, or fallback
  const orgName = 'My workspace';

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
          w-48 fixed left-0 top-0 bottom-0 bg-surface-panel border-r border-white/6 z-50 flex flex-col
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
            <span className="text-[13px] font-medium text-white/80 font-outfit">CraftMyFunnel</span>
          </Link>
          {/* Mobile close */}
          <button
            onClick={onClose}
            className="lg:hidden p-1 rounded hover:bg-white/5 text-white/40 hover:text-white/70 transition-colors"
            aria-label="Close sidebar"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Workspace switcher */}
        <div className="px-2 mb-3">
          <button
            className="w-full flex items-center justify-between border border-white/6 bg-white/2 rounded-md px-2 py-1.5 text-left group"
            aria-label="Switch workspace"
          >
            {/* TODO: org switcher — open org selection modal */}
            <span className="text-[12px] font-normal text-white/50 truncate">{orgName}</span>
            <ChevronDown className="w-3 h-3 text-white/25 flex-shrink-0 ml-1" />
          </button>
        </div>

        {/* Nav groups */}
        <nav className="flex-1 overflow-y-auto px-2 pb-2">
          {navGroups.map((group, gi) => (
            <div key={gi} className={gi > 0 ? 'mt-1' : ''}>
              {group.label && (
                <div className="pt-4 pb-1 px-2">
                  <span className="text-[10px] uppercase font-medium tracking-wide text-white/20">
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
                          ? 'bg-blue-500/12 text-blue-400'
                          : 'text-white/45 hover:bg-white/4 hover:text-white/70'
                        }
                      `}
                    >
                      <Icon className="w-[14px] h-[14px] flex-shrink-0" />
                      {item.label}
                    </Link>
                  );
                })}
              </div>
            </div>
          ))}

          {/* Tools — discovery surface for gated/hidden feature areas */}
          <div className="mt-1 pt-4 border-t border-white/6">
            <Link
              href="/settings/features"
              onClick={onClose}
              className={`
                flex items-center gap-2 px-2 py-[5px] rounded-md text-[12.5px] font-normal
                transition-colors duration-150
                ${pathname?.startsWith('/settings/features')
                  ? 'bg-blue-500/12 text-blue-400'
                  : 'text-white/45 hover:bg-white/4 hover:text-white/70'
                }
              `}
            >
              <Wrench className="w-[14px] h-[14px] flex-shrink-0" />
              <span className="flex-1">Tools</span>
              <span className="text-[9.5px] text-white/25">{HIDDEN_FEATURE_COUNT}</span>
            </Link>
          </div>
        </nav>

        {/* User identity row — single source of truth */}
        <div className="border-t border-white/5 px-2 py-3">
          <div className="flex items-center gap-2">
            <div className="w-6 h-6 rounded-full bg-blue-500/20 text-blue-400 flex items-center justify-center text-[10px] font-medium flex-shrink-0">
              {userInitials}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-[12px] font-medium text-slate-300 truncate leading-none">{userName}</p>
              <p className="text-[10px] text-white/30 mt-0.5 leading-none">{planLabel}</p>
            </div>
            <button
              className="p-1 text-white/20 hover:text-white/50 transition-colors flex-shrink-0"
              aria-label="User menu"
            >
              <MoreHorizontal className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      </aside>
    </>
  );
}
