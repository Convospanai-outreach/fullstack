"use client";

import Link from "next/link";
import { Button } from "@/components/ui/Button";

export function QuickStartGuide() {
    return (
        <div className="col-span-1 md:col-span-3 bg-gradient-to-r from-blue-900/40 to-purple-900/40 border border-blue-500/30 rounded-2xl p-8 mb-8 relative overflow-hidden">
            <div className="absolute top-0 right-0 w-64 h-64 bg-blue-500/10 rounded-full blur-3xl -mr-16 -mt-16 pointer-events-none" />

            <div className="relative z-10">
                <h2 className="text-2xl font-bold text-white mb-2">Welcome to ConvoSpan! 🚀</h2>
                <p className="text-gray-300 mb-6 max-w-2xl">
                    Your AI agent army is ready to work. To get started, you need to launch your first campaign.
                    We'll help you find leads, write emails, and schedule the outreach.
                </p>

                <div className="flex flex-wrap gap-4">
                    <Link href="/campaigns/new">
                        <Button variant="primary" className="px-6 py-6 text-lg shadow-lg shadow-blue-500/20">
                            <span className="mr-2">✨</span> Create First Campaign
                        </Button>
                    </Link>

                    <Link href="/leads">
                        <Button variant="outline" className="px-6 py-6 text-lg bg-black/20 hover:bg-black/40 border-white/10">
                            📥 Import Leads
                        </Button>
                    </Link>

                    <Link href="/settings">
                        <Button variant="ghost" className="px-6 py-6 text-lg text-gray-400 hover:text-white">
                            ⚙️ Connect Accounts
                        </Button>
                    </Link>
                </div>
            </div>
        </div>
    );
}
