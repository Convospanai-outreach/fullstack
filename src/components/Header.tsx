"use client";

import Link from "next/link";
import { ActionButton } from "./auth/ActionButton";
import { useSession } from "next-auth/react";
import { NotificationBell } from "./ui/NotificationBell";
import Nav from "./Nav";

export default function Header() {
    const { data: session } = useSession();
    // Default to FREE if plan not set, safe fallback
    const isFree = !session?.user?.plan || session.user.plan === "FREE";
    const isLoggedIn = !!session?.user;

    return (
        <header className="glass fixed top-0 left-0 w-full z-20 py-4 px-6 flex justify-between items-center bg-[#020617]/80 backdrop-blur-md border-b border-white/5">
            <Link href="/" className="text-2xl font-extrabold bg-gradient-to-r from-purple-400 to-blue-400 bg-clip-text text-transparent hover:opacity-80 transition-opacity">
                ConvoSpan
            </Link>

            <div className="flex items-center gap-6">
                <nav className="hidden md:flex items-center gap-6 text-sm font-medium text-gray-300">
                    <Link href="/pricing" className="hover:text-white transition-colors">Pricing</Link>
                    <Link href="/contact" className="hover:text-white transition-colors">Contact</Link>
                </nav>

                {isLoggedIn && isFree && (
                    <Link href="/pricing">
                        <button className="hidden md:block bg-gradient-to-r from-purple-600 to-pink-600 text-white px-4 py-2 rounded-lg text-xs font-bold uppercase tracking-wider shadow-lg hover:shadow-purple-500/20 hover:scale-105 transition-all">
                            Upgrade Plan
                        </button>
                    </Link>
                )}

                <div className="flex items-center gap-4">
                    <NotificationBell />
                    <Nav />
                </div>
            </div>
        </header>
    );
}
