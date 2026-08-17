"use client";

import { useEffect, useState } from "react";
import { SectionHeader } from "@/components/ui/SectionHeader";

export default function HealthPage() {
    const [health, setHealth] = useState<any>(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const fetchHealth = async () => {
            try {
                const res = await fetch((process.env['NEXT_PUBLIC_API_URL'] || "/api/proxy") + "/monitoring/health");
                const json = await res.json();
                if (json.ok) setHealth(json.health);
            } catch (e) {
                console.error(e);
            } finally {
                setLoading(false);
            }
        };
        fetchHealth();
        const interval = setInterval(fetchHealth, 10000); // Poll every 10s
        return () => clearInterval(interval);
    }, []);

    if (loading) return <div className="p-8 text-white">Checking system health...</div>;
    if (!health) return <div className="p-8 text-white">System status unavailable</div>;

    const StatusBadge = ({ status }: { status: string }) => (
        <span className={`px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider ${status === "healthy" || status === "ok"
            ? "bg-green-500/20 text-green-400 border border-green-500/30"
            : status === "degraded"
                ? "bg-yellow-500/20 text-yellow-400 border border-yellow-500/30"
                : "bg-red-500/20 text-red-400 border border-red-500/30"
            }`}>
            {status}
        </span>
    );

    return (
        <div className="p-8 min-h-screen bg-black relative overflow-hidden">
            {/* Background Gradients */}
            <div className="absolute top-0 left-0 w-full h-full overflow-hidden z-0 pointer-events-none">
                <div className="absolute top-[-10%] left-[-10%] w-[50%] h-[50%] bg-purple-900/20 rounded-full blur-[120px]" />
                <div className="absolute bottom-[-10%] right-[-10%] w-[50%] h-[50%] bg-blue-900/20 rounded-full blur-[120px]" />
            </div>

            <div className="relative z-10 max-w-4xl mx-auto">
                <SectionHeader title="System Health" subtitle="Real-time infrastructure monitoring" />

                <div className="mt-8 grid gap-6">
                    {/* Database Card */}
                    <div className="glass p-6 rounded-xl border border-white/10 flex justify-between items-center">
                        <div className="flex items-center gap-4">
                            <div className="w-12 h-12 rounded-lg bg-blue-500/20 flex items-center justify-center text-2xl">
                                🗄️
                            </div>
                            <div>
                                <h3 className="text-lg font-bold text-white">Database</h3>
                                <div className="text-sm text-gray-400">PostgreSQL Connection</div>
                            </div>
                        </div>
                        <div className="text-right">
                            <StatusBadge status={health.database.status} />
                            <div className="text-xs text-gray-500 mt-2 font-mono">Latency: {health.database.latency}ms</div>
                        </div>
                    </div>

                    {/* System Card */}
                    <div className="glass p-6 rounded-xl border border-white/10 flex justify-between items-center">
                        <div className="flex items-center gap-4">
                            <div className="w-12 h-12 rounded-lg bg-purple-500/20 flex items-center justify-center text-2xl">
                                🖥️
                            </div>
                            <div>
                                <h3 className="text-lg font-bold text-white">System</h3>
                                <div className="text-sm text-gray-400">Server Status</div>
                            </div>
                        </div>
                        <div className="text-right">
                            <StatusBadge status={health.system.status} />
                            <div className="text-xs text-gray-500 mt-2 font-mono">Uptime: {Math.floor(health.system.uptime / 60)}m</div>
                        </div>
                    </div>
                </div>

                <div className="mt-6 text-center text-xs text-gray-600">
                    Last updated: {new Date(health.timestamp).toLocaleString()}
                </div>
            </div>
        </div>
    );
}
