"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
    LayoutDashboard,
    Megaphone,
    FileText,
    Inbox,
    Users,
    Settings,
    LogOut,
    CreditCard,
    Workflow,
    Store,
    Database,
    BookOpen,
    CheckSquare
} from "lucide-react";
import { WorkspaceSwitcher } from "./WorkspaceSwitcher";

const sidebarLinks = [
    { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
    { href: "/marketplace", label: "Marketplace", icon: Store },
    { href: "/campaigns", label: "Campaigns", icon: Megaphone },
    { href: "/pipeline", label: "Pipeline", icon: LayoutDashboard },
    { href: "/workflows", label: "Workflows", icon: Workflow },
    { href: "/playbooks", label: "Playbooks", icon: BookOpen },
    { href: "/templates", label: "Templates", icon: FileText },
    { href: "/knowledge", label: "Knowledge Base", icon: Database },
    { href: "/inbox", label: "Inbox", icon: Inbox },
    { href: "/leads", label: "Leads", icon: Users },
    { href: "/billing", label: "Billing", icon: CreditCard },
    { href: "/settings", label: "Settings", icon: Settings },
    { href: "/approvals", label: "Approvals", icon: CheckSquare },
];

export function DashboardSidebar() {
    const pathname = usePathname();

    return (
        <aside className="w-64 fixed left-0 top-0 bottom-0 bg-surface-panel border-r border-border z-50 flex flex-col">
            <div className="p-4 border-b border-border">
                <WorkspaceSwitcher />
            </div>

            <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto">
                {sidebarLinks.map((link) => {
                    const Icon = link.icon;
                    const isActive = pathname === link.href || pathname?.startsWith(`${link.href}/`);

                    return (
                        <Link
                            key={link.href}
                            href={link.href}
                            className={`flex items-center gap-3 px-3 py-2 rounded-md text-sm font-medium transition-all duration-200 group ${isActive
                                ? "bg-brand-500/10 text-brand-600 dark:text-brand-400"
                                : "text-muted-foreground hover:text-foreground hover:bg-surface-accent"
                                }`}
                        >
                            <Icon className={`w-4 h-4 ${isActive ? "text-brand-600 dark:text-brand-400" : "text-muted-foreground group-hover:text-foreground"}`} />
                            {link.label}
                        </Link>
                    );
                })}
            </nav>

            <div className="p-4 border-t border-white/5">
                <button className="flex items-center gap-3 px-4 py-3 w-full rounded-xl text-sm font-medium text-gray-400 hover:text-red-400 hover:bg-red-500/10 transition-all">
                    <LogOut className="w-5 h-5" />
                    Sign Out
                </button>
            </div>
        </aside>
    );
}
