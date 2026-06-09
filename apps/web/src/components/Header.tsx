"use client";

import Link from "next/link";
import { useAuth } from "@clerk/nextjs";
import { NotificationBell } from "./ui/NotificationBell";
import Nav from "./Nav";
import { Button } from "./ui/button";
import { LogoMark } from "@/components/brand/LogoMark";

export default function Header() {
    const { isSignedIn } = useAuth();
    // Default to FREE if plan not set, safe fallback
    const isFree = true;
    const isLoggedIn = Boolean(isSignedIn);

    return (
        <header className="fixed top-6 left-1/2 -translate-x-1/2 w-[calc(100%-3rem)] max-w-[1600px] z-50 transition-all duration-500">
            <div className="glass-premium rounded-[2rem] px-8 py-4 flex justify-between items-center shadow-[0_0_50px_rgba(0,0,0,0.5)] border-white/10 relative overflow-hidden group">
                {/* Animated Border Glow */}
                <div className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-1000 pointer-events-none">
                    <div className="absolute inset-0 bg-gradient-to-r from-transparent via-indigo-500/10 to-transparent -translate-x-full group-hover:translate-x-full transition-transform duration-[2000ms]" />
                </div>

                <Link href="/" className="relative z-10 flex items-center gap-3 group/logo">
                    <LogoMark priority className="h-8 w-8 transition-transform group-hover/logo:scale-110" />
                    <span className="text-2xl font-black font-outfit bg-gradient-to-r from-white via-white to-indigo-300 bg-clip-text text-transparent tracking-tight">
                        CraftMyFunnel
                    </span>
                    <div className="px-2 py-0.5 rounded-full bg-indigo-500/10 border border-indigo-500/20">
                        <span className="text-[10px] font-black uppercase tracking-widest text-indigo-400">Pro</span>
                    </div>
                </Link>

                <div className="flex items-center gap-8 relative z-10">
                    <nav className="hidden md:flex items-center gap-8 text-sm font-bold tracking-tight text-slate-400">
                        <Link href="/pricing" className="hover:text-white transition-colors relative group/link">
                            Pricing
                            <div className="absolute -bottom-1 left-0 w-0 h-0.5 bg-indigo-500 group-hover/link:w-full transition-all" />
                        </Link>
                        <Link href="/contact" className="hover:text-white transition-colors relative group/link">
                            Support
                            <div className="absolute -bottom-1 left-0 w-0 h-0.5 bg-indigo-500 group-hover/link:w-full transition-all" />
                        </Link>
                    </nav>

                    <div className="h-6 w-px bg-white/10 hidden md:block" />

                    <div className="flex items-center gap-4">
                        {isLoggedIn && isFree && (
                            <Link href="/pricing" className="hidden lg:block">
                                <Button className="bg-white text-black hover:bg-slate-200 rounded-xl font-bold font-outfit text-xs px-5">
                                    Upgrade
                                </Button>
                            </Link>
                        )}
                        <NotificationBell />
                        <Nav />
                    </div>
                </div>
            </div>
        </header>
    );
}
