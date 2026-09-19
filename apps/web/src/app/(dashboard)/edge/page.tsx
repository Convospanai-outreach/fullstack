"use client";

import { useEffect, useState } from "react";
import {
    Cpu,
    CheckCircle2,
    XCircle,
    HelpCircle,
    RefreshCw,
    Radio,
    Terminal
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { getBrowserApiBase } from "@/lib/api/browserBase";

interface EdgeRuntimeStatus {
    configured: boolean;
    available: boolean;
    optional: boolean;
    required: boolean;
    status: "UP" | "DOWN" | "NOT_CONFIGURED";
    message: string;
    endpoint?: string;
    latencyMs?: number;
}

const STATUS_STYLES: Record<EdgeRuntimeStatus["status"], { icon: typeof CheckCircle2; className: string }> = {
    UP: { icon: CheckCircle2, className: "bg-emerald-500/10 text-emerald-400 border-emerald-500/20" },
    DOWN: { icon: XCircle, className: "bg-red-500/10 text-red-400 border-red-500/20" },
    NOT_CONFIGURED: { icon: HelpCircle, className: "bg-muted text-muted-foreground border-border" },
};

export default function EdgeRuntimePage() {
    const [status, setStatus] = useState<EdgeRuntimeStatus | null>(null);
    const [loading, setLoading] = useState(false);

    const loadStatus = async (announce = false) => {
        setLoading(true);
        try {
            const res = await fetch(getBrowserApiBase() + "/edge/status");
            if (!res.ok) throw new Error("Failed to check edge runtime status");
            const { data } = await res.json();
            setStatus(data);
            if (announce) {
                if (data.status === "UP") {
                    toast.success("Edge Heartbeat Received", {
                        description: `Reachable in ${data.latencyMs}ms.`,
                    });
                } else {
                    toast.error("Edge Runtime Unreachable", { description: data.message });
                }
            }
        } catch (err) {
            toast.error("Couldn't check edge runtime status");
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        loadStatus();
    }, []);

    const style = status ? STATUS_STYLES[status.status] : STATUS_STYLES.NOT_CONFIGURED;
    const StatusIcon = style.icon;

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                    <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-cyan-500/10 border border-cyan-500/20 text-cyan-400 text-xs font-semibold uppercase tracking-wider mb-2">
                        <Radio className="w-3.5 h-3.5" />
                        On-Prem Edge Runtime
                    </div>
                    <h1 className="text-3xl font-extrabold tracking-tight text-foreground">
                        Edge Runtime
                    </h1>
                    <p className="text-sm text-muted-foreground">
                        Local inference endpoint used as a fallback/offload target for on-prem hardware.
                    </p>
                </div>
                <Button
                    variant="outline"
                    size="sm"
                    onClick={() => loadStatus(true)}
                    disabled={loading}
                    className="bg-muted border-border text-foreground text-xs"
                >
                    <RefreshCw className={`w-3.5 h-3.5 mr-1.5 ${loading ? "animate-spin" : ""}`} />
                    Check Status
                </Button>
            </div>

            {/* Status card */}
            <div className="p-6 rounded-2xl bg-muted border border-border space-y-4">
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2.5">
                        <Cpu className="w-5 h-5 text-cyan-400" />
                        <div>
                            <h2 className="text-base font-bold text-foreground">Configured Edge Endpoint</h2>
                            <p className="text-xs text-muted-foreground font-mono">
                                {status?.endpoint || "Not configured"}
                            </p>
                        </div>
                    </div>
                    <span className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold border ${style.className}`}>
                        <StatusIcon className="w-3.5 h-3.5" />
                        {status?.status ?? "CHECKING"}
                    </span>
                </div>
                <p className="text-xs text-muted-foreground">{status?.message ?? "Checking edge runtime availability..."}</p>
                {typeof status?.latencyMs === "number" && (
                    <p className="text-xs text-cyan-400 font-mono">Latency: {status.latencyMs}ms</p>
                )}
            </div>

            {/* Quick Install Terminal Box */}
            <div className="p-6 rounded-2xl bg-muted border border-border space-y-3">
                <div className="flex items-center justify-between">
                    <h3 className="text-sm font-bold text-foreground flex items-center gap-2">
                        <Terminal className="w-4 h-4 text-cyan-400" />
                        Configure your edge endpoint
                    </h3>
                </div>
                <p className="text-xs text-muted-foreground">
                    Set <code className="text-cyan-300">ON_PREM_AI_ENDPOINT</code> (or <code className="text-cyan-300">EDGE_NODE_URL</code>) on
                    your deployment to point at a locally hosted inference server exposing a <code className="text-cyan-300">/health</code> endpoint.
                </p>
            </div>
        </div>
    );
}
