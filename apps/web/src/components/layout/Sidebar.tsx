"use client";

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
    LayoutDashboard,
    Megaphone,
    Wand2,
    Bot,
    CreditCard,
    Settings,
    ShieldCheck,
    Zap,
    Mail,
    ArrowRightLeft,
    TrendingUp,
    Cpu
} from 'lucide-react';

export function Sidebar() {
    const pathname = usePathname();

    const navItems = [
        { name: 'Dashboard', href: '/dashboard', icon: LayoutDashboard },
        { name: 'Unified Inbox', href: '/inbox', icon: Mail },
        { name: 'Campaigns', href: '/campaigns', icon: Megaphone },
        { name: 'CRM Bridge', href: '/crm', icon: ArrowRightLeft },
        { name: 'Agent Builder', href: '/agents/builder', icon: Bot },
        { name: 'Studio', href: '/studio', icon: Wand2 },
        // { name: 'Playbooks', href: '/playbooks', icon: BookOpen },
        { name: 'Campaign ROI', href: '/analytics/roi', icon: TrendingUp },
        { name: 'AI Fleet', href: '/analytics/ai', icon: Cpu },
        { name: 'Governance', href: '/governance', icon: ShieldCheck },
        { name: 'Billing', href: '/billing', icon: CreditCard },
        { name: 'Settings', href: '/settings', icon: Settings },
    ];

    return (
        <aside className="w-72 glass-strong h-screen flex flex-col p-6 sticky top-0 border-r border-white/5">
            <div className="flex items-center gap-3 px-2 mb-10">
                <div className="bg-accent-blue rounded-xl p-2 shadow-glow">
                    <Zap className="w-6 h-6 text-white" />
                </div>
                <span className="text-2xl font-bold text-white tracking-tight">ConvoSpan</span>
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
                        <span className="text-[10px] font-bold uppercase tracking-widest text-accent-mint">Pro</span>
                    </div>
                    <div className="h-1.5 bg-white/10 rounded-full overflow-hidden">
                        <div className="h-full bg-accent-mint w-3/4" />
                    </div>
                    <p className="text-[10px] text-text-muted mt-2">75% of monthly credits used</p>
                </div>

                <div className="mt-4 flex items-center justify-between px-2">
                    <span className="text-[10px] font-bold uppercase tracking-widest text-text-muted">v2.0.4 - Canary</span>
                    <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                </div>
            </div>
        </aside>
    );
}
