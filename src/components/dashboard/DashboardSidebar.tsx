"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { signOut } from "next-auth/react";
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
    CheckSquare,
    GitBranch,
    X,
} from "lucide-react";
import { WorkspaceSwitcher } from "./WorkspaceSwitcher";

const sidebarGroups = [
    {
        label: "Core",
        items: [
            { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
            { href: "/inbox", label: "Inbox", icon: Inbox },
            { href: "/leads", label: "Leads", icon: Users },
        ],
    },
    {
        label: "Outreach",
        items: [
            { href: "/campaigns", label: "Campaigns", icon: Megaphone },
            { href: "/workflows", label: "Workflows", icon: Workflow },
            { href: "/playbooks", label: "Playbooks", icon: BookOpen },
            { href: "/templates", label: "Templates", icon: FileText },
            { href: "/pipeline", label: "Pipeline", icon: GitBranch },
        ],
    },
    {
        label: "Intelligence",
        items: [
            { href: "/knowledge", label: "Knowledge Base", icon: Database },
            { href: "/marketplace", label: "Marketplace", icon: Store },
            { href: "/approvals", label: "Approvals", icon: CheckSquare },
        ],
    },
    {
        label: "Account",
        items: [
            { href: "/billing", label: "Billing", icon: CreditCard },
            { href: "/settings", label: "Settings", icon: Settings },
        ],
    },
];

interface DashboardSidebarProps {
    isOpen?: boolean;
    onClose?: () => void;
}

export function DashboardSidebar({ isOpen, onClose }: DashboardSidebarProps) {
    const pathname = usePathname();

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
                    w-64 fixed left-0 top-0 bottom-0 bg-surface-panel border-r border-border z-50 flex flex-col
                    transition-transform duration-300 ease-in-out
                    lg:translate-x-0
                    ${isOpen ? "translate-x-0" : "-translate-x-full"}
                `}
                role="navigation"
                aria-label="Main navigation"
            >
                <div className="p-4 border-b border-border flex items-center justify-between">
                    <WorkspaceSwitcher />
                    {/* Mobile close button */}
                    <button
                        onClick={onClose}
                        className="lg:hidden p-1.5 rounded-lg hover:bg-white/5 text-muted-foreground hover:text-foreground transition-colors"
                        aria-label="Close sidebar"
                    >
                        <X className="w-5 h-5" />
                    </button>
                </div>

                <nav className="flex-1 px-3 py-4 space-y-6 overflow-y-auto">
                    {sidebarGroups.map((group) => (
                        <div key={group.label}>
                            <div className="px-3 mb-2">
                                <span className="text-[10px] font-bold uppercase tracking-[0.15em] text-muted-foreground/50">
                                    {group.label}
                                </span>
                            </div>
                            <div className="space-y-0.5">
                                {group.items.map((link) => {
                                    const Icon = link.icon;
                                    const isActive = pathname === link.href || pathname?.startsWith(`${link.href}/`);

                                    return (
                                        <Link
                                            key={link.href}
                                            href={link.href}
                                            onClick={() => onClose?.()}
                                            className={`flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-all duration-200 group ${isActive
                                                ? "bg-brand-500/10 text-brand-600 dark:text-brand-400 shadow-sm"
                                                : "text-muted-foreground hover:text-foreground hover:bg-surface-accent"
                                                }`}
                                        >
                                            <Icon className={`w-4 h-4 ${isActive ? "text-brand-600 dark:text-brand-400" : "text-muted-foreground group-hover:text-foreground"}`} />
                                            {link.label}
                                            {isActive && (
                                                <div className="ml-auto w-1.5 h-1.5 rounded-full bg-brand-500" />
                                            )}
                                        </Link>
                                    );
                                })}
                            </div>
                        </div>
                    ))}
                </nav>

                <div className="p-4 border-t border-white/5">
                    <button
                        onClick={() => signOut({ callbackUrl: "/login" })}
                        className="flex items-center gap-3 px-4 py-3 w-full rounded-xl text-sm font-medium text-gray-400 hover:text-red-400 hover:bg-red-500/10 transition-all"
                    >
                        <LogOut className="w-5 h-5" />
                        Sign Out
                    </button>
                </div>
            </aside>
        </>
    );
}
