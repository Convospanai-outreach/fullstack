"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { signOut, useSession } from "next-auth/react";
import {
    LayoutDashboard,
    Megaphone,
    FileText,
    Inbox,
    Users,
    Activity,
    Bot,
    Settings,
    LogOut,
    CreditCard,
    CheckSquare,
    X,
} from "lucide-react";
import { WorkspaceSwitcher } from "./WorkspaceSwitcher";
import { PRODUCT_FLAGS } from "@/lib/productFlags";

const sidebarGroups = [
    {
        label: "Core",
        items: [
            { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
            { href: "/inbox", label: "Inbox", icon: Inbox },
            { href: "/leads", label: "Leads", icon: Users },
            { href: "/intel", label: "Intel", icon: Activity },
        ],
    },
    {
        label: "Outreach",
        items: [
            { href: "/campaigns", label: "Campaigns", icon: Megaphone },
            { href: "/templates", label: "Templates", icon: FileText },
            { href: "/agents/swarm", label: "Agent Swarm", icon: Bot },
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
].filter((group) => {
    if (group.label === "Intelligence") {
        return !PRODUCT_FLAGS.emailFirstBeta;
    }

    return true;
});

interface DashboardSidebarProps {
    isOpen?: boolean;
    onClose?: () => void;
}

export function DashboardSidebar({ isOpen, onClose }: DashboardSidebarProps) {
    const pathname = usePathname();
    const { data: session } = useSession();

    const userName = session?.user?.name ?? "User";
    const userEmail = session?.user?.email ?? "";
    const userInitial = userName.charAt(0).toUpperCase();

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

                {/* User profile + sign out */}
                <div className="p-4 border-t border-white/5 space-y-3">
                    {/* User info */}
                    <div className="flex items-center gap-3 px-2 py-1.5">
                        <div className="w-8 h-8 rounded-full bg-gradient-to-tr from-brand-500 to-purple-500 flex items-center justify-center text-white text-xs font-bold shrink-0 shadow-lg">
                            {session?.user?.image ? (
                                <img src={session.user.image} alt={userName} className="w-8 h-8 rounded-full object-cover" />
                            ) : (
                                userInitial
                            )}
                        </div>
                        <div className="flex-1 min-w-0">
                            <p className="text-sm font-semibold text-white truncate">{userName}</p>
                            <p className="text-[11px] text-muted-foreground truncate">{userEmail}</p>
                        </div>
                        <Link href="/settings/profile" className="p-1 rounded-md hover:bg-white/10 text-muted-foreground hover:text-white transition-colors" aria-label="Profile settings">
                            <Settings className="w-3.5 h-3.5" />
                        </Link>
                    </div>

                    {/* Sign out */}
                    <button
                        onClick={() => signOut({ callbackUrl: "/login" })}
                        className="flex items-center gap-3 px-4 py-2.5 w-full rounded-xl text-sm font-medium text-gray-400 hover:text-red-400 hover:bg-red-500/10 transition-all"
                    >
                        <LogOut className="w-4 h-4" />
                        Sign Out
                    </button>
                </div>
            </aside>
        </>
    );
}
