"use client";
import { useState, useEffect, useCallback, useRef } from "react";
import { Wifi, WifiOff, AlertTriangle, RefreshCw, Server, Cpu, Activity } from "lucide-react";

interface ServiceStatus {
    name: string;
    status: "online" | "degraded" | "offline";
    latencyMs?: number;
    detail?: string;
}

interface SystemStatus {
    overall: "online" | "degraded" | "offline";
    services: ServiceStatus[];
    checkedAt: string;
}

const ICON_MAP: Record<string, React.FC<{ className?: string }>> = {
    "ConvoSpan DB": Server,
    "Raspberry Pi Node": Cpu,
    "Netjana Signals": Activity,
};

const STATUS_COLORS = {
    online: {
        dot: "bg-emerald-400",
        text: "text-emerald-400",
        ring: "ring-emerald-500/30",
        bg: "bg-emerald-500/10",
        label: "Online",
    },
    degraded: {
        dot: "bg-amber-400",
        text: "text-amber-400",
        ring: "ring-amber-500/30",
        bg: "bg-amber-500/10",
        label: "Degraded",
    },
    offline: {
        dot: "bg-red-400",
        text: "text-red-400",
        ring: "ring-red-500/30",
        bg: "bg-red-500/10",
        label: "Offline",
    },
};

function PulseDot({ status }: { status: ServiceStatus["status"] }) {
    const colors = STATUS_COLORS[status];
    return (
        <span className="relative flex h-2.5 w-2.5">
            {status === "online" && (
                <span className={`animate-ping absolute inline-flex h-full w-full rounded-full ${colors.dot} opacity-50`} />
            )}
            <span className={`relative inline-flex rounded-full h-2.5 w-2.5 ${colors.dot}`} />
        </span>
    );
}

// Skeleton pill shown before any data arrives — no flash/empty corner
function StatusPillSkeleton() {
    return (
        <div className="fixed bottom-4 right-4 z-50">
            <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-slate-800/60 backdrop-blur border border-white/10 shadow-xl animate-pulse">
                <div className="w-3.5 h-3.5 rounded-full bg-slate-600" />
                <div className="h-3 w-32 rounded bg-slate-600" />
                <div className="w-2.5 h-2.5 rounded-full bg-slate-600 ml-1" />
            </div>
        </div>
    );
}

export function ConnectionStatusBar() {
    // Start with a defined "loading" state so there is never an empty corner
    const [systemStatus, setSystemStatus] = useState<SystemStatus | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [hasLoaded, setHasLoaded] = useState(false);
    const [expanded, setExpanded] = useState(false);
    const triggerRef = useRef<HTMLButtonElement>(null);

    const fetchStatus = useCallback(async (showLoader = false) => {
        if (showLoader) setIsLoading(true);
        try {
            const res = await fetch("/api/system/status");
            if (res.ok) {
                const data = await res.json();
                setSystemStatus(data);
                setHasLoaded(true);
            }
        } catch {
            // silently fail on background refresh
        } finally {
            setIsLoading(false);
        }
    }, []);

    useEffect(() => {
        fetchStatus(true);
        const interval = setInterval(() => fetchStatus(false), 30000);
        return () => clearInterval(interval);
    }, [fetchStatus]);

    useEffect(() => {
        if (triggerRef.current) {
            triggerRef.current.setAttribute("aria-expanded", expanded ? "true" : "false");
        }
    }, [expanded]);

    // Show skeleton until first load completes
    if (!hasLoaded) return <StatusPillSkeleton />;

    if (!systemStatus) return null;

    const overall = systemStatus.overall;
    const overallColors = STATUS_COLORS[overall];
    const checkedAt = new Date(systemStatus.checkedAt).toLocaleTimeString();

    const OverallIcon = overall === "online" ? Wifi : overall === "degraded" ? AlertTriangle : WifiOff;

    return (
        <div className="fixed bottom-4 right-4 z-50">
            {/* Expanded Card */}
            {expanded && (
                <div className="mb-2 bg-slate-900/95 backdrop-blur-xl border border-white/10 rounded-2xl p-4 shadow-2xl w-72 animate-in slide-in-from-bottom-2 duration-200">
                    <div className="flex items-center justify-between mb-3">
                        <h3 className="text-sm font-semibold text-white">System Connections</h3>
                        <span className="text-[10px] text-slate-500">checked {checkedAt}</span>
                    </div>

                    <div className="space-y-2">
                        {systemStatus.services.map((svc) => {
                            const colors = STATUS_COLORS[svc.status];
                            const Icon = ICON_MAP[svc.name] ?? Server;
                            return (
                                <div
                                    key={svc.name}
                                    className={`flex items-center gap-3 p-2.5 rounded-xl ${colors.bg} ring-1 ${colors.ring}`}
                                >
                                    <Icon className={`w-4 h-4 shrink-0 ${colors.text}`} />
                                    <div className="flex-1 min-w-0">
                                        <div className="flex items-center justify-between">
                                            <span className="text-xs font-medium text-white truncate">{svc.name}</span>
                                            <span className={`text-[10px] font-semibold uppercase tracking-wider ${colors.text} ml-2 shrink-0`}>
                                                {colors.label}
                                            </span>
                                        </div>
                                        {svc.detail && (
                                            <p className="text-[10px] text-slate-400 truncate mt-0.5">{svc.detail}</p>
                                        )}
                                        {svc.latencyMs != null && (
                                            <p className="text-[10px] text-slate-500 mt-0.5">{svc.latencyMs}ms</p>
                                        )}
                                    </div>
                                    <PulseDot status={svc.status} />
                                </div>
                            );
                        })}
                    </div>

                    <button
                        onClick={() => fetchStatus(true)}
                        disabled={isLoading}
                        className="mt-3 w-full flex items-center justify-center gap-1.5 text-[11px] text-slate-400 hover:text-white transition-colors py-1"
                        aria-label="Refresh connection status"
                    >
                        <RefreshCw className={`w-3 h-3 ${isLoading ? "animate-spin" : ""}`} />
                        Refresh
                    </button>
                </div>
            )}

            {/* Toggle Pill — always min 44px tall for WCAG touch targets */}
            <button
                ref={triggerRef}
                onClick={() => setExpanded(!expanded)}
                aria-label={`System status: ${overall}. Click to ${expanded ? "close" : "expand"}.`}
                className={`flex items-center gap-2 px-4 py-2.5 rounded-full shadow-xl border transition-all duration-200 text-xs font-medium backdrop-blur min-h-[44px]
                    ${overallColors.bg} ring-1 ${overallColors.ring} border-white/10 hover:ring-2 hover:scale-105`}
            >
                <OverallIcon className={`w-3.5 h-3.5 ${overallColors.text}`} />
                <span className="text-white">
                    {overall === "online"
                        ? "All Systems Operational"
                        : overall === "degraded"
                        ? "Partial Outage"
                        : "Systems Offline"}
                </span>
                <PulseDot status={overall} />
            </button>
        </div>
    );
}
