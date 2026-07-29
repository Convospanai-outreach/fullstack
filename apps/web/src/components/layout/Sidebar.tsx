"use client";

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
    LayoutDashboard,
    Megaphone,
    CreditCard,
    Settings,
    Mail,
    Activity,
    ArrowRightLeft,
    TrendingUp,
    ShieldCheck,
    Bot,
} from 'lucide-react';
import { PRODUCT_FLAGS } from "@/lib/productFlags";
import { LogoMark } from "@/components/brand/LogoMark";

export function Sidebar() {
    const pathname = usePathname();

    const navItems = [
        { name: 'Dashboard', href: '/dashboard', icon: LayoutDashboard },
        { name: 'Approvals', href: '/approvals', icon: ShieldCheck },
        { name: 'Unified Inbox', href: '/inbox', icon: Mail },
        { name: 'Intel', href: '/intel', icon: Activity },
        { name: 'Campaigns', href: '/campaigns', icon: Megaphone },
        { name: 'Agent Swarm', href: '/agents/swarm', icon: Bot },
        { name: 'CRM Bridge', href: '/crm', icon: ArrowRightLeft },
        { name: 'Campaign ROI', href: '/analytics/roi', icon: TrendingUp },
        { name: 'Governance', href: '/governance', icon: ShieldCheck },
        { name: 'Billing', href: '/billing', icon: CreditCard },
        { name: 'Settings', href: '/settings', icon: Settings },
    ].filter((item) => {
        if (item.href === '/crm') {
            return !PRODUCT_FLAGS.emailFirstBeta;
        }

        return true;
    });

    return (
        <aside className="w-72 glass-strong h-screen flex flex-col p-6 sticky top-0 border-r border-white/5">
            <div className="flex items-center gap-3 px-2 mb-10">
                <LogoMark className="h-10 w-10 rounded-xl shadow-glow" />
                <span className="text-2xl font-bold text-white tracking-tight">CraftMyFunnel</span>
            </div>

            <nav className="flex-1 space-y-2">
                {navItems.map((item) => {
                    const Icon = item.icon;
                    const isActive = pathname === item.href;

                    return (
                        <Link
                            key={item.name}
                            href={item.href}
                            className={`flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-semibold transition-all duration-300 ${isActive
                                ? 'bg-accent-blue/10 text-accent-blue'
                                : 'text-text-secondary hover:text-white hover:bg-white/5'
                                }`}
                        >
                            <Icon className={`w-5 h-5 ${isActive ? 'text-accent-blue' : 'text-text-muted transition-colors group-hover:text-white'}`} />
                            {item.name}
                        </Link>
                    );
                })}
            </nav>

            <div className="mt-auto pt-6 border-t border-white/5">
                <div className="bg-white/5 rounded-2xl p-4">
                    <div className="flex justify-between items-center mb-2">
                        <span className="text-[10px] font-bold uppercase tracking-widest text-text-muted">Plan</span>
                        <span className="text-[10px] font-bold uppercase tracking-widest text-accent-mint">Beta</span>
                    </div>
                    <div className="h-1.5 bg-white/10 rounded-full overflow-hidden">
                        <div className="h-full bg-accent-mint w-3/4" />
                    </div>
                    <p className="text-[10px] text-text-muted mt-2">Email-first private beta rollout</p>
                </div>

                <div className="mt-4 flex items-center justify-between px-2">
                    <span className="text-[10px] font-bold uppercase tracking-widest text-text-muted">Email-first beta</span>
                    <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                </div>
            </div>
        </aside>
    );
}
