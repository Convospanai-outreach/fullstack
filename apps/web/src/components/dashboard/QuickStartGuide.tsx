"use client";

import Link from "next/link";
import { Button } from "@/components/ui/button";

export function QuickStartGuide() {
    return (
        <div className="relative mb-8 col-span-1 overflow-hidden rounded-2xl border border-border bg-card p-8 md:col-span-3">
            <div className="pointer-events-none absolute -mr-16 -mt-16 right-0 top-0 h-64 w-64 rounded-full bg-blue-500/[0.06] blur-3xl" />

            <div className="relative z-10 flex gap-6">
                <div className="w-1 self-stretch rounded-full bg-blue-500 flex-shrink-0" />
                <div className="flex-1 min-w-0">
                    <h2 className="mb-2 text-2xl font-bold text-foreground">Welcome to CraftMyFunnel</h2>
                    <p className="mb-6 max-w-2xl text-muted-foreground">
                        Start with one clear outcome: launch your first campaign with approvals and visible controls.
                        The setup flow guides lead import, channel readiness, and launch steps.
                    </p>

                    <div className="flex flex-wrap gap-4">
                        <Link href="/campaigns/new">
                            <Button variant="default" className="px-6 py-6 text-lg">
                                Create first campaign
                            </Button>
                        </Link>

                        <Link href="/leads">
                            <Button variant="outline" className="px-6 py-6 text-lg">
                                Import leads
                            </Button>
                        </Link>

                        <Link href="/settings">
                            <Button variant="ghost" className="px-6 py-6 text-lg text-muted-foreground hover:text-foreground">
                                Connect accounts
                            </Button>
                        </Link>
                    </div>
                </div>
            </div>
        </div>
    );
}

