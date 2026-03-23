"use client";

import { AppShell } from "@/components/layout/AppShell";
import { DashboardController } from "@/components/dashboard/DashboardController";
import { Button } from "@/components/ui/button";
import Link from "next/link";
import { Bot, Megaphone } from "lucide-react";

export default function DashboardPage() {
    return (
        <AppShell>
            <div className="flex justify-between items-center mb-8">
                <div>
                    <h1 className="text-3xl font-black text-white tracking-tight">Command Center</h1>
                    <p className="text-text-secondary">AI-Driven Growth Engine & ROI Analytics</p>
                </div>
                <div className="flex gap-3">
                    <Link href="/agents/builder">
                        <Button variant="outline" className="gap-2">
                            <Bot className="w-4 h-4" />
                            Build Agent
                        </Button>
                    </Link>
                    <Link href="/campaigns/new">
                        <Button variant="default" className="gap-2 shadow-glow">
                            <Megaphone className="w-4 h-4" />
                            New Campaign
                        </Button>
                    </Link>
                </div>
            </div>

            {/* Main Controller handles the view logic */}
            <DashboardController />

        </AppShell>
    );
}

