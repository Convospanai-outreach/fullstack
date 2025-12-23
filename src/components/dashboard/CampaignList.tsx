"use client";
import { useState } from "react";
import { toast } from "sonner";
import ScheduleCampaignModal from "./ScheduleCampaignModal";
import { Calendar } from "lucide-react";

export default function CampaignList({ campaigns }: any) {
    const [running, setRunning] = useState<string | null>(null);
    const [scheduleModal, setScheduleModal] = useState<{ id: string, name: string } | null>(null);

    const handleRun = async (id: string) => {
        // ... (existing code) ...
        setRunning(id);
        try {
            const res = await fetch("/api/orchestrator/run", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ campaignId: id }),
            });
            if (!res.ok) throw new Error("Failed to start campaign");
            toast.success("Campaign triggered!");
        } catch (err) {
            console.error(err);
            toast.error("Failed to trigger campaign");
        } finally {
            setRunning(null);
        }
    };

    const handleExport = async () => {
        // ... (existing code) ...
    };

    return (
        <div className="flex flex-col gap-3">
            {scheduleModal && (
                <ScheduleCampaignModal
                    isOpen={!!scheduleModal}
                    onClose={() => setScheduleModal(null)}
                    campaignId={scheduleModal.id}
                    campaignName={scheduleModal.name}
                    onSchedule={() => {
                        // Optional: Refresh list or update local state
                        window.location.reload(); // Simple refresh to show updated status
                    }}
                />
            )}

            <div className="flex justify-end">
                {/* ... export button ... */}
            </div>
            {campaigns.map((c: any) => (
                <div key={c.id} className="flex items-center justify-between p-3 rounded-lg bg-[rgba(255,255,255,0.02)] border border-[rgba(255,255,255,0.04)]">
                    <div>
                        <div className="font-semibold text-sm">{c.name}</div>
                        <div className="text-xs text-gray-400">{c.audience} • {c.leads} leads</div>
                    </div>
                    <div className="flex items-center gap-3">
                        <div className="text-sm text-gray-300">
                            {c.status === 'scheduled' ? (
                                <span className="text-yellow-400 flex items-center gap-1"><Calendar className="w-3 h-3" /> Scheduled</span>
                            ) : c.status}
                        </div>
                        <button
                            onClick={() => setScheduleModal({ id: c.id, name: c.name })}
                            className="p-2 rounded bg-blue-500/20 hover:bg-blue-500/40 text-blue-300 transition"
                            title="Schedule for Later"
                        >
                            <Calendar className="w-4 h-4" />
                        </button>
                        <button
                            onClick={() => handleRun(c.id)}
                            disabled={running === c.id}
                            className="p-2 rounded bg-purple-500/20 hover:bg-purple-500/40 text-purple-300 transition"
                            title="Run Now"
                        >
                            {running === c.id ? "..." : "▶"}
                        </button>
                        <a
                            href={`/dashboard/campaigns/${c.id}/edit`}
                            className="p-2 rounded bg-white/5 hover:bg-white/10 text-gray-400 hover:text-white transition"
                            title="Edit Campaign"
                        >
                            ✎
                        </a>
                    </div>
                </div>
            ))}
        </div>
    );
}
