"use client";

import React, { useState } from 'react';
import { toast } from 'sonner';
import { ActionButton } from '../auth/ActionButton';
import { Calendar } from 'lucide-react';

interface Props {
    isOpen: boolean;
    onClose: () => void;
    campaignId: string;
    campaignName: string;
    onSchedule: () => void;
}

export default function ScheduleCampaignModal({ isOpen, onClose, campaignId, campaignName, onSchedule }: Props) {
    const [date, setDate] = useState("");
    const [loading, setLoading] = useState(false);

    if (!isOpen) return null;

    const handleSchedule = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!date) return;

        setLoading(true);
        try {
            const res = await fetch(process.env['NEXT_PUBLIC_API_URL'] + "/orchestrator/run", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    campaignId,
                    startDate: new Date(date).toISOString()
                }),
            });

            if (!res.ok) throw new Error("Failed to schedule campaign");

            toast.success(`Campaign scheduled for ${new Date(date).toLocaleString()}`);
            onSchedule();
            onClose();
        } catch (error) {
            toast.error("Scheduling failed");
            console.error(error);
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in">
            <div className="glass w-full max-w-md p-6 rounded-2xl relative border border-white/10 shadow-2xl">
                <button
                    onClick={onClose}
                    className="absolute top-4 right-4 text-gray-400 hover:text-white"
                >
                    ✕
                </button>

                <div className="mb-6">
                    <h2 className="text-xl font-bold text-white mb-1">Schedule Campaign</h2>
                    <p className="text-sm text-gray-400">Run <span className="text-purple-300 font-medium">{campaignName}</span> automatically at a future time.</p>
                </div>

                <form onSubmit={handleSchedule} className="space-y-6">
                    <div>
                        <label className="block text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">
                            Select Start Time
                        </label>
                        <div className="relative group">
                            <input
                                type="datetime-local"
                                value={date}
                                onChange={(e) => setDate(e.target.value)}
                                className="w-full bg-white/5 border border-white/10 rounded-lg px-4 py-3 text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-purple-500/50 focus:border-purple-500/50 transition-all [color-scheme:dark]"
                                required
                                min={new Date().toISOString().slice(0, 16)}
                            />
                            <Calendar className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
                        </div>
                        <p className="mt-2 text-xs text-gray-500">
                            Timezone: {Intl.DateTimeFormat().resolvedOptions().timeZone}
                        </p>
                    </div>

                    <ActionButton fullWidth disabled={loading}>
                        {loading ? "Scheduling..." : "Confirm Schedule"}
                    </ActionButton>
                </form>
            </div>
        </div>
    );
}
