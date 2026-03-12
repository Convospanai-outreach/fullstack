"use client";

import { useEffect, useState } from "react";
import { StatCard } from "@/components/dashboard/StatCard";
import { Activity, Ban, ShieldAlert, ZapOff } from "lucide-react";

export default function ObservabilityDashboard() {
    const [data, setData] = useState<any>(null);
    const [loading, setLoading] = useState(true);
    const [range, setRange] = useState("24h");

    useEffect(() => {
        fetch(`${process.env.NEXT_PUBLIC_API_URL}/admin/observability?range=${range}`)
            .then((res) => res.json())
            .then((d) => {
                setData(d);
                setLoading(false);
            })
            .catch((err) => console.error(err));
    }, [range]);

    if (loading) return <div className="p-8">Loading System Telemetry...</div>;
    if (!data?.metrics) return <div className="p-8 text-red-500">Failed to load data. Ensure you are Admin.</div>;

    return (
        <div className="p-8 space-y-8 bg-gray-50 min-h-screen">
            <div className="flex justify-between items-center">
                <h1 className="text-3xl font-bold text-gray-900">System Observability</h1>
                <select
                    value={range}
                    onChange={(e) => setRange(e.target.value)}
                    className="border rounded p-2"
                >
                    <option value="24h">Last 24 Hours</option>
                    <option value="7d">Last 7 Days</option>
                    <option value="30d">Last 30 Days</option>
                </select>
            </div>

            {/* 1. High Level Metrics */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <StatCard label="Active Teams" value={data.metrics.activeTeams} icon={Activity} />
                <StatCard label="Suspended Teams" value={data.metrics.suspendedTeams} icon={Ban} />
                <StatCard label="Contract Denials" value={data.metrics.totalDenials} icon={ShieldAlert} />
                <StatCard label="Kill Switch Events" value={data.metrics.totalKillSwitch} icon={ZapOff} />
            </div>

            {/* 2. Security Events Feed */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                <div className="bg-white p-6 rounded-lg shadow">
                    <h2 className="text-xl font-semibold mb-4 text-red-600">Contract Denials</h2>
                    {data.events.denials.length === 0 ? (
                        <p className="text-gray-500">No denials recorded.</p>
                    ) : (
                        <ul className="space-y-3 font-mono text-sm max-h-96 overflow-y-auto">
                            {data.events.denials.map((e: any) => (
                                <li key={e.id} className="border-b pb-2">
                                    <span className="text-gray-400">{new Date(e.timestamp).toLocaleTimeString()}</span>
                                    <span className="ml-2 font-bold text-red-700">{e.payload.checkType}</span>: {e.payload.reason}
                                    <div className="text-xs text-gray-400 mt-1">Team: {e.teamId}</div>
                                </li>
                            ))}
                        </ul>
                    )}
                </div>

                <div className="bg-white p-6 rounded-lg shadow">
                    <h2 className="text-xl font-semibold mb-4 text-purple-600">Kill Switch Activity</h2>
                    {data.events.killSwitch.length === 0 ? (
                        <p className="text-gray-500">No kill switch events.</p>
                    ) : (
                        <ul className="space-y-3 font-mono text-sm">
                            {data.events.killSwitch.map((e: any) => (
                                <li key={e.id} className="bg-red-50 p-2 rounded">
                                    <div className="font-bold">{e.payload.targetType} FREEZE</div>
                                    <div>{e.payload.reason}</div>
                                    <div className="text-xs text-gray-500">{new Date(e.timestamp).toLocaleString()}</div>
                                </li>
                            ))}
                        </ul>
                    )}
                </div>
            </div>

            {/* 3. Usage & Cost */}
            <div className="bg-white p-6 rounded-lg shadow">
                <h2 className="text-xl font-semibold mb-4">AI Limit Breaches & Usage</h2>
                <div className="overflow-x-auto">
                    <table className="min-w-full text-left text-sm">
                        <thead>
                            <tr className="bg-gray-100">
                                <th className="p-2">Team ID</th>
                                <th className="p-2">Tokens In</th>
                                <th className="p-2">Tokens Out</th>
                                <th className="p-2">Est. Cost</th>
                            </tr>
                        </thead>
                        <tbody>
                            {data.usage.map((u: any) => (
                                <tr key={u.teamId} className="border-b">
                                    <td className="p-2 font-mono">{u.teamId}</td>
                                    <td className="p-2">{u._sum.tokensIn?.toLocaleString()}</td>
                                    <td className="p-2">{u._sum.tokensOut?.toLocaleString()}</td>
                                    <td className="p-2">${u._sum.cost?.toFixed(4)}</td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
}
