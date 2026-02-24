"use client";

import { NotificationBell } from "@/components/ui/NotificationBell";
import Link from "next/link";
import OfflineIndicator from "@/components/layout/OfflineIndicator";
import {
    Search,
    Sparkles,
    Menu,
} from "lucide-react";
import { QuickActions } from "./QuickActions";
import { useSession } from "next-auth/react";

function getUserInitials(name?: string | null): string {
    if (!name) return "U";
    const parts = name.trim().split(/\s+/);
    if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase();
    return parts[0].substring(0, 2).toUpperCase();
}

export function DashboardHeader({ onToggleSidebar }: { onToggleSidebar?: () => void }) {
    const { data: session } = useSession();
    const initials = getUserInitials(session?.user?.name);

    return (
        <header className="fixed top-0 left-0 lg:left-64 right-0 h-16 border-b border-border z-40 flex items-center justify-between px-4 lg:px-8 bg-surface-app/80 backdrop-blur-md">
            {/* Left: Mobile toggle + Logo */}
            <div className="flex items-center gap-4">
                {/* Mobile sidebar toggle */}
                <button
                    onClick={onToggleSidebar}
                    className="lg:hidden p-2 rounded-lg hover:bg-white/5 text-muted-foreground hover:text-foreground transition-colors"
                    aria-label="Toggle sidebar"
                >
                    <Menu className="w-5 h-5" />
                </button>

                <Link href="/dashboard" className="flex items-center gap-2 group lg:hidden">
                    <div className="h-7 w-7 rounded-lg bg-gradient-to-br from-indigo-600 to-purple-600 flex items-center justify-center shadow-lg shadow-indigo-500/20">
                        <Sparkles className="w-4 h-4 text-white" />
                    </div>
                    <span className="text-lg font-black tracking-tight text-foreground font-outfit">ConvoSpan</span>
                </Link>
            </div>

            {/* Right: Search, Actions & Profile */}
            <div className="flex items-center gap-3 lg:gap-4">
                <div 
                    className="relative max-w-sm w-48 lg:w-64 hidden md:block group cursor-pointer"
                    onClick={() => window.dispatchEvent(new CustomEvent('convo:open-command-palette'))}
                >
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground group-focus-within:text-brand-500 transition-colors" />
                    <input
                        type="text"
                        placeholder="Search..."
                        readOnly
                        className="w-full bg-surface-accent/50 border border-input rounded-lg pl-10 pr-16 py-1.5 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:bg-surface-accent focus:border-brand-500/50 focus:ring-1 focus:ring-brand-500/20 transition-all cursor-pointer"
                    />
                    <kbd className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none text-[10px] font-mono font-bold text-muted-foreground/60 bg-white/5 border border-white/10 rounded px-1.5 py-0.5 tracking-wider">⌘K</kbd>
                </div>

                <div className="h-6 w-px bg-border hidden md:block" />

                <button
                    className="hidden md:flex items-center gap-2 px-3 py-1.5 rounded-lg bg-brand-500/10 hover:bg-brand-500/20 text-brand-400 border border-brand-500/20 transition-all text-sm font-medium group"
                    aria-label="Ask AI"
                >
                    <Sparkles className="w-4 h-4 group-hover:text-brand-300 transition-colors" />
                    <span className="hidden lg:inline">Ask AI</span>
                </button>

                <OfflineIndicator />
                <QuickActions />

                <div className="h-6 w-px bg-border" />

                <NotificationBell />

                <div className="w-8 h-8 rounded-full bg-gradient-to-r from-indigo-500 to-purple-500 p-[2px] cursor-pointer hover:scale-110 transition-all duration-200 shadow-sm hover:shadow-indigo-500/30">
                    <div className="w-full h-full rounded-full bg-surface-panel flex items-center justify-center overflow-hidden">
                        <span className="text-xs font-bold text-white">{initials}</span>
                    </div>
                </div>
            </div>
        </header>
    );
}

