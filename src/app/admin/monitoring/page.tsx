"use client";

import { useEffect, useState } from "react";
import useSWR from "swr";
import Link from "next/link";
import { formatDistanceToNow } from "date-fns";

const fetcher = (url: string) => fetch(url).then((res) => res.json());

export default function AdminMonitoringPage() {
    const { data: health, error } = useSWR("/api/monitoring/health", fetcher, { refreshInterval: 10000 });

    const statusColor = health?.status === "healthy" ? "text-green-400" : "text-red-400";
    const bgStatusColor = health?.status === "healthy" ? "bg-green-500/10" : "bg-red-500/10";

    return (
        <div className="space-y-6">
            <div className="flex justify-between items-center">
                <div>
                    <h1 className="text-3xl font-bold text-white">System Health</h1>
                    <p className="text-gray-400 mt-2">Real-time infrastructure monitoring</p>
                </div>
                <div className={`px-4 py-2 rounded-full border border-white/10 ${bgStatusColor} flex items-center space-x-2`}>
                    <div className={`w-2 h-2 rounded-full ${health?.status === "healthy" ? "bg-green-400" : "bg-red-400 animate-pulse"}`} />
                    <span className={`font-mono font-bold uppercase ${statusColor}`}>{health?.status || "LOADING..."}</span>
                </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                {/* Database Card */}
                <div className="glass p-6 rounded-xl border border-white/10">
                    <h3 className="text-gray-400 text-sm uppercase tracking-wider mb-2">Database</h3>
                    <div className="flex items-end justify-between">
                        <span className="text-2xl font-bold text-white uppercase">{health?.checks?.database || "..."}</span>
                        <div className={`w-3 h-3 rounded-full ${health?.checks?.database === "connected" ? "bg-green-500" : "bg-red-500"}`} />
                    </div>
                </div>

                {/* Uptime Card */}
                <div className="glass p-6 rounded-xl border border-white/10">
                    <h3 className="text-gray-400 text-sm uppercase tracking-wider mb-2">Uptime</h3>
                    <div className="flex items-end justify-between">
                        <span className="text-2xl font-bold text-white">
                            {health?.checks?.uptime ? (health.checks.uptime / 3600).toFixed(2) + " hrs" : "..."}
                        </span>
                        <span className="text-xs text-gray-500">Since restart</span>
                    </div>
                </div>

                {/* Response Time Card (Simulated) */}
                <div className="glass p-6 rounded-xl border border-white/10">
                    <h3 className="text-gray-400 text-sm uppercase tracking-wider mb-2">Last Checked</h3>
                    <div className="text-white text-lg">
                        {health?.checks?.timestamp ? new Date(health.checks.timestamp).toLocaleTimeString() : "..."}
                    </div>
                </div>
            </div>

            <div className="p-4 rounded-lg bg-blue-500/10 border border-blue-500/20 text-blue-300 text-sm">
                Need deep inspection? <Link href="/admin/audit" className="underline hover:text-blue-200">View Audit Logs</Link>
            </div>
        </div>
    );
}
