"use client";

import React, { useEffect, useState } from "react";
import { SectionHeader } from "@/components/ui/SectionHeader";

export default function RateLimitPage() {
    const [stats, setStats] = useState<any[]>([]);
    const [config, setConfig] = useState({ maxRequests: 100, windowMs: 60000 });
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        fetchStats();
    }, []);

    const fetchStats = async () => {
        try {
            const res = await fetch((process.env['NEXT_PUBLIC_API_URL'] || "/api/proxy") + "/admin/rate-limits");
            const data = await res.json();
            if (data.stats) setStats(data.stats);
        } catch (error) {
            console.error(error);
        } finally {
            setLoading(false);
        }
    };

    const handleUpdate = async (e: React.FormEvent) => {
        e.preventDefault();
        try {
            await fetch((process.env['NEXT_PUBLIC_API_URL'] || "/api/proxy") + "/admin/rate-limits", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(config)
            });
            alert("Configuration updated!");
        } catch (error) {
            console.error(error);
        }
    };

    if (loading) return <div className="p-8 text-white">Loading stats...</div>;

    return (
        <div className="p-8 min-h-screen bg-black relative overflow-hidden">
            {/* Background Gradients */}
            <div className="absolute top-0 left-0 w-full h-full overflow-hidden z-0 pointer-events-none">
                <div className="absolute top-[-10%] left-[-10%] w-[50%] h-[50%] bg-purple-900/20 rounded-full blur-[120px]" />
                <div className="absolute bottom-[-10%] right-[-10%] w-[50%] h-[50%] bg-blue-900/20 rounded-full blur-[120px]" />
            </div>

            <div className="relative z-10 max-w-6xl mx-auto">
                <SectionHeader title="Rate Limiting" subtitle="Traffic Control & Protection" />

                <div className="mt-8 grid grid-cols-1 md:grid-cols-3 gap-6">
                    {/* Config Card */}
                    <div className="glass p-6 rounded-xl border border-white/10">
                        <h3 className="text-lg font-bold text-white mb-4">Configuration</h3>
                        <form onSubmit={handleUpdate} className="space-y-4">
                            <div>
                                <label className="block text-sm text-gray-400 mb-1">Max Requests</label>
                                <input
                                    type="number"
                                    value={config.maxRequests}
                                    onChange={(e) => setConfig({ ...config, maxRequests: parseInt(e.target.value) })}
                                    className="w-full bg-white/5 border border-white/10 rounded-lg px-4 py-2 text-white"
                                />
                            </div>
                            <div>
                                <label className="block text-sm text-gray-400 mb-1">Window (ms)</label>
                                <input
                                    type="number"
                                    value={config.windowMs}
                                    onChange={(e) => setConfig({ ...config, windowMs: parseInt(e.target.value) })}
                                    className="w-full bg-white/5 border border-white/10 rounded-lg px-4 py-2 text-white"
                                />
                            </div>
                            <button
                                type="submit"
                                className="w-full bg-blue-600 hover:bg-blue-700 text-white py-2 rounded-lg font-medium"
                            >
                                Update Limits
                            </button>
                        </form>
                    </div>

                    {/* Stats Table */}
                    <div className="md:col-span-2 glass p-6 rounded-xl border border-white/10">
                        <h3 className="text-lg font-bold text-white mb-4">Active Traffic (In-Memory)</h3>
                        <div className="overflow-x-auto">
                            <table className="w-full text-left">
                                <thead className="bg-white/5 text-gray-400 text-sm uppercase">
                                    <tr>
                                        <th className="px-4 py-3">IP Address</th>
                                        <th className="px-4 py-3">Requests</th>
                                        <th className="px-4 py-3">Reset Time</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-white/10">
                                    {stats.length === 0 ? (
                                        <tr>
                                            <td colSpan={3} className="px-4 py-8 text-center text-gray-500">
                                                No active traffic recorded in current window.
                                            </td>
                                        </tr>
                                    ) : (
                                        stats.map((stat, i) => (
                                            <tr key={i} className="hover:bg-white/5">
                                                <td className="px-4 py-3 text-white font-mono text-sm">{stat.ip}</td>
                                                <td className="px-4 py-3 text-white">{stat.count}</td>
                                                <td className="px-4 py-3 text-gray-400 text-sm">
                                                    {new Date(stat.resetTime).toLocaleTimeString()}
                                                </td>
                                            </tr>
                                        ))
                                    )}
                                </tbody>
                            </table>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
