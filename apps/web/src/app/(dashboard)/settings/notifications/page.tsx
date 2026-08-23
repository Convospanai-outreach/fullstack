"use client";

import { useEffect, useState } from "react";
import useSWR, { mutate } from "swr";
import { SectionHeader } from "@/components/ui/SectionHeader";
import { GlassCard } from "@/components/ui/GlassCard";
import { getBrowserApiUrl } from "@/lib/api/browserBase";

const fetcher = (url: string) => fetch(url).then((res) => res.json());

export default function NotificationsPage() {
    const { data: settings } = useSWR(getBrowserApiUrl("/settings"), fetcher);
    // Note: /api/settings returns 'notifications' object nested
    const [toggles, setToggles] = useState({
        emailGlobal: true,
        emailCampaign: true,
        emailLeads: true,
        inAppGlobal: true
    });

    useEffect(() => {
        if (settings?.notifications) {
            setToggles({
                emailGlobal: settings.notifications.emailGlobal,
                emailCampaign: settings.notifications.emailCampaign,
                emailLeads: settings.notifications.emailLeads,
                inAppGlobal: settings.notifications.inAppGlobal
            });
        }
    }, [settings]);

    const handleToggle = async (key: string, value: boolean) => {
        const newToggles = { ...toggles, [key]: value };
        setToggles(newToggles);

        try {
            await fetch(getBrowserApiUrl("/settings/notifications"), {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ [key]: value })
            });
            mutate(getBrowserApiUrl("/settings"));
        } catch (error) {
            console.error("Failed to update notification");
        }
    };

    return (
        <div className="space-y-6">
            <SectionHeader title="Notifications" subtitle="Control how and when we contact you." />

            <GlassCard className="p-8 space-y-8">
                {/* Email Section */}
                <div>
                    <h3 className="text-lg font-semibold text-white mb-4 flex items-center">
                        <span className="mr-2">📧</span> Email Alerts
                    </h3>
                    <div className="space-y-4">
                        <Toggle
                            label="Global Email Switch"
                            desc="Turn off all email notifications"
                            checked={toggles.emailGlobal}
                            onChange={(v) => handleToggle("emailGlobal", v)}
                        />
                        <Toggle
                            label="Campaign Updates"
                            desc="When a campaign finishes or needs attention"
                            checked={toggles.emailCampaign}
                            onChange={(v) => handleToggle("emailCampaign", v)}
                        />
                        <Toggle
                            label="New Leads"
                            desc="When a new lead is enriched or replies"
                            checked={toggles.emailLeads}
                            onChange={(v) => handleToggle("emailLeads", v)}
                        />
                    </div>
                </div>

                <div className="border-t border-white/10 pt-8">
                    <h3 className="text-lg font-semibold text-white mb-4 flex items-center">
                        <span className="mr-2">🔔</span> In-App
                    </h3>
                    <Toggle
                        label="Global In-App Notifications"
                        desc="Show toast notifications and badges"
                        checked={toggles.inAppGlobal}
                        onChange={(v) => handleToggle("inAppGlobal", v)}
                    />
                </div>
            </GlassCard>
        </div>
    );
}

function Toggle({ label, desc, checked, onChange }: { label: string, desc: string, checked: boolean, onChange: (v: boolean) => void }) {
    return (
        <div className="flex items-center justify-between">
            <div>
                <div className="text-white font-medium">{label}</div>
                <div className="text-sm text-gray-500">{desc}</div>
            </div>
            <button
                onClick={() => onChange(!checked)}
                className={`w-12 h-6 rounded-full transition-colors relative ${checked ? "bg-blue-600" : "bg-gray-700"}`}
            >
                <div className={`absolute top-1 left-1 w-4 h-4 rounded-full bg-white transition-transform ${checked ? "translate-x-6" : "translate-x-0"}`} />
            </button>
        </div>
    );
}
