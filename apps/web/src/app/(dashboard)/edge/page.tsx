"use client";

import { useEffect, useState } from "react";
import {
    Cpu,
    CheckCircle2,
    XCircle,
    HelpCircle,
    RefreshCw,
    Radio,
    Terminal,
    Fingerprint,
    ListChecks,
    Play
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

interface EdgeDetails {
    reachable: boolean;
    hardwareId?: string | null;
    services?: string[];
    capabilities?: { tokenize: boolean; classify: boolean; generate: boolean; execute: boolean };
}

const CAPABILITY_ROWS: { key: keyof NonNullable<EdgeDetails["capabilities"]>; label: string }[] = [
    { key: "tokenize", label: "PII vault (sanitise and re-identify on the device)" },
    { key: "classify", label: "Local intent scoring and response critique" },
    { key: "generate", label: "Offline LLM drafts" },
    { key: "execute", label: "Browser actions" },
];

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

    const [details, setDetails] = useState<EdgeDetails | null>(null);
    const [testing, setTesting] = useState(false);
    const [testResult, setTestResult] = useState<string | null>(null);

    const loadDetails = async () => {
        try {
            const res = await fetch(getBrowserApiBase() + "/edge/details");
            if (res.ok) setDetails((await res.json()).data);
        } catch {
            setDetails({ reachable: false });
        }
    };

    const runScoreTest = async () => {
        setTesting(true);
        setTestResult(null);
        try {
            const res = await fetch(getBrowserApiBase() + "/edge/test-score", { method: "POST" });
            const body = await res.json();
            setTestResult(body.success ? `Edge node scored the sample ${body.data.score} in ${body.data.latencyMs}ms.` : (body.error ?? "Test failed."));
        } catch {
            setTestResult("Couldn't reach the edge node.");
        } finally {
            setTesting(false);
        }
    };

    useEffect(() => {
        loadStatus();
        loadDetails();
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
                        Private edge server
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

            {/* Hardware fingerprint */}
            <div className="p-6 rounded-2xl bg-muted border border-border space-y-2">
                <h3 className="text-sm font-bold text-foreground flex items-center gap-2">
                    <Fingerprint className="w-4 h-4 text-cyan-400" />
                    Hardware fingerprint
                </h3>
                <p className="text-xs text-muted-foreground font-mono">
                    {details?.hardwareId ?? (details ? "Not available while the node is unreachable" : "Checking...")}
                </p>
                {!!details?.services?.length && (
                    <p className="text-xs text-muted-foreground">Services: {details.services.join(", ")}</p>
                )}
            </div>

            {/* Capability matrix */}
            <div className="p-6 rounded-2xl bg-muted border border-border space-y-3">
                <h3 className="text-sm font-bold text-foreground flex items-center gap-2">
                    <ListChecks className="w-4 h-4 text-cyan-400" />
                    Capabilities
                </h3>
                <ul className="space-y-1.5">
                    {CAPABILITY_ROWS.map(({ key, label }) => {
                        const on = details?.capabilities?.[key] === true;
                        return (
                            <li key={key} className="flex items-center gap-2 text-xs text-muted-foreground">
                                {on ? <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" /> : <XCircle className="w-3.5 h-3.5 text-muted-foreground" />}
                                <span className={on ? "text-foreground" : undefined}>{label}</span>
                            </li>
                        );
                    })}
                </ul>
            </div>

            {/* Score test */}
            <div className="p-6 rounded-2xl bg-muted border border-border space-y-3">
                <h3 className="text-sm font-bold text-foreground flex items-center gap-2">
                    <Play className="w-4 h-4 text-cyan-400" />
                    Test intent scoring
                </h3>
                <p className="text-xs text-muted-foreground">Sends one fixed sample sentence to the node. No lead data is sent.</p>
                <Button variant="outline" size="sm" onClick={runScoreTest} disabled={testing} className="bg-muted border-border text-foreground text-xs">
                    {testing ? "Testing..." : "Run test"}
                </Button>
                {testResult && <p className="text-xs text-cyan-400 font-mono">{testResult}</p>}
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
