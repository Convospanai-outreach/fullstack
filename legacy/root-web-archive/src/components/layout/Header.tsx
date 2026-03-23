"use client";

import { Bell, Search, ChevronDown } from 'lucide-react';

export function Header() {
    return (
        <header className="h-20 glass border-b border-white/5 flex items-center justify-between px-8 shrink-0">
            {/* Search Bar Container */}
            <div className="relative w-96 group">
                <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-text-muted group-focus-within:text-accent-blue transition-colors" />
                <input
                    type="text"
                    placeholder="Search leads, campaigns, or AI playbooks..."
                    className="w-full bg-white/5 border border-white/5 rounded-xl pl-12 pr-4 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-accent-blue focus:bg-white/10 transition-all"
                />
                <div className="absolute right-3 top-1/2 -translate-y-1/2 flex gap-1">
                    <kbd className="hidden sm:inline-flex h-5 select-none items-center gap-1 rounded border border-white/10 bg-white/5 px-1.5 font-mono text-[10px] font-medium text-text-muted opacity-100">
                        <span className="text-xs">⌘</span>K
                    </kbd>
                </div>
            </div>

            {/* Action Icons & User Profile */}
            <div className="flex items-center gap-6">
                <button className="relative p-2 rounded-xl hover:bg-white/5 transition text-text-secondary hover:text-white">
                    <Bell className="w-5 h-5" />
                    <span className="absolute top-2 right-2 w-2 h-2 bg-red-500 rounded-full border-2 border-slate-950" />
                </button>

                <div className="h-8 w-[1px] bg-white/10" />

                <button className="flex items-center gap-3 p-1.5 pr-3 rounded-xl hover:bg-white/5 transition group">
                    <div className="w-9 h-9 rounded-lg bg-gradient-to-tr from-accent-blue to-accent-violet flex items-center justify-center text-white font-bold text-sm shadow-glow group-hover:scale-105 transition-transform">
                        JD
                    </div>
                    <div className="text-left hidden sm:block">
                        <p className="text-sm font-semibold text-white leading-tight">John Doe</p>
                        <p className="text-[10px] text-text-muted font-bold uppercase tracking-wider">Enterprise Admin</p>
                    </div>
                    <ChevronDown className="w-4 h-4 text-text-muted group-hover:text-white transition-colors" />
                </button>
            </div>
        </header>
    );
}
