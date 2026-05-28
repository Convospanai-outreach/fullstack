"use client";

import Link from "next/link";
import { Button } from "@/components/ui/button";

export function QuickStartGuide() {
    return (
        <div className="relative mb-8 col-span-1 overflow-hidden rounded-2xl border border-blue-500/30 bg-gradient-to-r from-blue-900/40 to-purple-900/40 p-8 md:col-span-3">
            <div className="pointer-events-none absolute -mr-16 -mt-16 right-0 top-0 h-64 w-64 rounded-full bg-blue-500/10 blur-3xl" />

            <div className="relative z-10">
                <h2 className="mb-2 text-2xl font-bold text-white">Welcome to CraftMyFunnel</h2>
                <p className="mb-6 max-w-2xl text-gray-300">
                    Start with one clear outcome: launch your first campaign with approvals and visible controls.
                    The setup flow guides lead import, channel readiness, and launch steps.
                </p>

                <div className="flex flex-wrap gap-4">
                    <Link href="/campaigns/new">
                        <Button variant="default" className="px-6 py-6 text-lg shadow-lg shadow-blue-500/20">
                            Create first campaign
                        </Button>
                    </Link>

                    <Link href="/leads">
                        <Button variant="outline" className="border-white/10 bg-black/20 px-6 py-6 text-lg hover:bg-black/40">
                            Import leads
                        </Button>
                    </Link>

                    <Link href="/settings">
                        <Button variant="ghost" className="px-6 py-6 text-lg text-gray-400 hover:text-white">
                            Connect accounts
                        </Button>
                    </Link>
                </div>
            </div>
        </div>
    );
}

