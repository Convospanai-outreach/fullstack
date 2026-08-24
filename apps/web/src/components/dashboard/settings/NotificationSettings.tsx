"use client";
import useSWR, { mutate } from "swr";
import { toast } from "sonner";
import { getBrowserApiBase } from "@/lib/api/browserBase";

const fetcher = (url: string) => fetch(url).then((res) => res.json());

export default function NotificationSettings() {
    const { data: prefs, error } = useSWR(getBrowserApiBase() + "/settings/notifications", fetcher);

    const handleToggle = async (key: string, value: boolean) => {
        // Optimistic update would be nice, but simple setState is okay for now
        // We actually need to send the whole object or PATCH. Our API expects PUT with full body or checks fields.
        // Let's assume we send updated state.

        if (!prefs) return;
        const newPrefs = { ...prefs, [key]: value };

        // Mutate local cache immediately
        mutate(getBrowserApiBase() + "/settings/notifications", newPrefs, false);

        try {
            await fetch(getBrowserApiBase() + "/settings/notifications", {
                method: "PUT",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(newPrefs),
            });
            toast.success("Settings saved");
        } catch (e) {
            toast.error("Failed to save settings");
            mutate(getBrowserApiBase() + "/settings/notifications"); // Revert
        } finally {
            // No saving state needed
        }
    };

    if (error) return <div className="text-red-400">Failed to load settings</div>;
    if (!prefs) return <div className="text-gray-400">Loading...</div>;

    return (
        <div className="space-y-6 text-gray-300">
            <h5 className="text-white font-medium border-b border-white/10 pb-2">Email Notifications</h5>

            <div className="flex items-center justify-between">
                <div>
                    <div className="text-white">Global Email</div>
                    <div className="text-xs text-gray-500">Enable/Disable all email notifications</div>
                </div>
                <Toggle checked={prefs.emailGlobal} onChange={(v) => handleToggle("emailGlobal", v)} />
            </div>

            <div className={`space-y-4 pl-4 border-l border-white/10 ml-2 transition-opacity ${!prefs.emailGlobal ? 'opacity-50 pointer-events-none' : ''}`}>
                <div className="flex items-center justify-between">
                    <div>
                        <div className="text-white">Campaign Updates</div>
                        <div className="text-xs text-gray-500">When a campaign starts or finishes</div>
                    </div>
                    <Toggle checked={prefs.emailCampaign} onChange={(v) => handleToggle("emailCampaign", v)} />
                </div>

                <div className="flex items-center justify-between">
                    <div>
                        <div className="text-white">New Leads</div>
                        <div className="text-xs text-gray-500">When a lead replies or is enriched</div>
                    </div>
                    <Toggle checked={prefs.emailLeads} onChange={(v) => handleToggle("emailLeads", v)} />
                </div>
            </div>

            <h5 className="text-white font-medium border-b border-white/10 pb-2 mt-8">In-App Notifications</h5>
            <div className="flex items-center justify-between">
                <div>
                    <div className="text-white">Global In-App</div>
                    <div className="text-xs text-gray-500">Show notifications in the dashboard bell</div>
                </div>
                <Toggle checked={prefs.inAppGlobal} onChange={(v) => handleToggle("inAppGlobal", v)} />
            </div>
        </div>
    );
}

function Toggle({ checked, onChange }: { checked: boolean; onChange: (v: boolean) => void }) {
    return (
        <button
            onClick={() => onChange(!checked)}
            className={`w-11 h-6 rounded-full transition-colors flex items-center px-1 ${checked ? "bg-purple-600" : "bg-white/10"
                }`}
        >
            <div
                className={`w-4 h-4 rounded-full bg-white transition-transform ${checked ? "translate-x-5" : "translate-x-0"
                    }`}
            />
        </button>
    );
}
