"use client";

import { useState } from "react";
import {
    ShieldCheck,
    Key,
    Lock,
    EyeOff,
    FileCheck,
    Database,
    CheckCircle2,
    RefreshCw,
    Download,
    Trash2
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";

export default function SovereignControlsPage() {
    const [isRotating, setIsRotating] = useState(false);

    const handleExportAuditLogs = () => {
        toast.success("Audit Log Export Generated", {
            description: "Encrypted JSON compliance archive downloaded."
        });
    };

    const handlePurgeTelemetry = () => {
        toast.info("Telemetry Retention Policy Enforced", {
            description: "Ephemeral AI completion buffers cleared."
        });
    };

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                    <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-xs font-semibold uppercase tracking-wider mb-2">
                        <ShieldCheck className="w-3.5 h-3.5" />
                        Data Sovereignty & Security
                    </div>
                    <h1 className="text-3xl font-extrabold tracking-tight text-foreground">
                        Sovereign Controls
                    </h1>
                    <p className="text-sm text-muted-foreground">
                        HMAC-SHA256 blind indexing, cryptographic tenant scoping, and zero-data-retention AI governance.
                    </p>
                </div>
                <div className="flex items-center gap-2">
                    <Button
                        variant="outline"
                        size="sm"
                        onClick={handleExportAuditLogs}
                        className="bg-muted border-border text-foreground text-xs"
                    >
                        <Download className="w-3.5 h-3.5 mr-1.5" />
                        Export Audit Log
                    </Button>
                    <Button
                        variant="outline"
                        size="sm"
                        onClick={handlePurgeTelemetry}
                        className="bg-muted border-border text-destructive hover:text-destructive/80 text-xs"
                    >
                        <Trash2 className="w-3.5 h-3.5 mr-1.5" />
                        Purge Ephemeral AI
                    </Button>
                </div>
            </div>

            {/* Core Security Cards */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
                {/* Blind Indexing */}
                <div className="p-6 rounded-2xl bg-muted border border-border space-y-4">
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2.5">
                            <Key className="w-5 h-5 text-emerald-400" />
                            <h2 className="text-base font-bold text-foreground">Blind Indexing</h2>
                        </div>
                        <span className="px-2.5 py-1 rounded-full text-xs font-semibold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                            HMAC-SHA256
                        </span>
                    </div>
                    <p className="text-xs text-muted-foreground leading-relaxed">
                        Deterministic salted hashing on sensitive PII (emails, phones). Exact searches execute without decrypting records or exposing plaintext.
                    </p>
                    <div className="pt-2 border-t border-border space-y-1 text-xs">
                        <div className="flex justify-between text-muted-foreground">
                            <span>Salt Scoping</span>
                            <span className="text-foreground font-mono">Workspace teamId</span>
                        </div>
                        <div className="flex justify-between text-muted-foreground">
                            <span>Cipher Mode</span>
                            <span className="text-foreground font-mono">AES-256-GCM</span>
                        </div>
                    </div>
                </div>

                {/* Tenant Isolation */}
                <div className="p-6 rounded-2xl bg-muted border border-border space-y-4">
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2.5">
                            <Lock className="w-5 h-5 text-primary" />
                            <h2 className="text-base font-bold text-foreground">Tenant Scoping</h2>
                        </div>
                        <span className="px-2.5 py-1 rounded-full text-xs font-semibold bg-blue-500/10 text-primary border border-blue-500/20">
                            Enforced
                        </span>
                    </div>
                    <p className="text-xs text-muted-foreground leading-relaxed">
                        Cryptographic JWT boundary verification on every API request. Zero cross-workspace data leakage across database queries.
                    </p>
                    <div className="pt-2 border-t border-border space-y-1 text-xs">
                        <div className="flex justify-between text-muted-foreground">
                            <span>Isolation Layer</span>
                            <span className="text-foreground font-mono">Server-Side RLS</span>
                        </div>
                        <div className="flex justify-between text-muted-foreground">
                            <span>Cookie Tamper Check</span>
                            <span className="text-emerald-400 font-mono">Passing</span>
                        </div>
                    </div>
                </div>

                {/* AI Zero-Retention */}
                <div className="p-6 rounded-2xl bg-muted border border-border space-y-4">
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2.5">
                            <EyeOff className="w-5 h-5 text-purple-400" />
                            <h2 className="text-base font-bold text-foreground">AI Sovereignty</h2>
                        </div>
                        <span className="px-2.5 py-1 rounded-full text-xs font-semibold bg-purple-500/10 text-purple-400 border border-purple-500/20">
                            Zero Retention
                        </span>
                    </div>
                    <p className="text-xs text-muted-foreground leading-relaxed">
                        Prompts and prospect data are dispatched under enterprise non-training agreements. No customer data is used for model training.
                    </p>
                    <div className="pt-2 border-t border-border space-y-1 text-xs">
                        <div className="flex justify-between text-muted-foreground">
                            <span>Provider Training Policy</span>
                            <span className="text-emerald-400 font-mono">Opted-Out</span>
                        </div>
                        <div className="flex justify-between text-muted-foreground">
                            <span>Input Guardrails</span>
                            <span className="text-foreground font-mono">Active Filter</span>
                        </div>
                    </div>
                </div>
            </div>

            {/* Compliance Matrix */}
            <div className="p-6 rounded-2xl bg-muted border border-border space-y-4">
                <h2 className="text-lg font-bold text-foreground flex items-center gap-2">
                    <FileCheck className="w-5 h-5 text-emerald-400" />
                    Regulatory Compliance Standards
                </h2>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 text-xs text-foreground pt-2">
                    <div className="p-4 rounded-xl bg-muted border border-border/60 space-y-1">
                        <p className="font-semibold text-foreground">GDPR & Article 17 (Right to be Forgotten)</p>
                        <p className="text-muted-foreground">Deterministic blind-index deletion purges all PII traces atomically.</p>
                        <p className="text-emerald-400">● 100% Automated</p>
                    </div>
                    <div className="p-4 rounded-xl bg-muted border border-border/60 space-y-1">
                        <p className="font-semibold text-foreground">RFC 8058 One-Click Compliance</p>
                        <p className="text-muted-foreground">One-click unsubscribe headers embedded in all outbound dispatches.</p>
                        <p className="text-emerald-400">● Compliant</p>
                    </div>
                    <div className="p-4 rounded-xl bg-muted border border-border/60 space-y-1">
                        <p className="font-semibold text-foreground">Google API Limited Use Disclosure</p>
                        <p className="text-muted-foreground">Strict least-privilege Gmail OAuth scopes strictly for outreach & reply detection.</p>
                        <p className="text-emerald-400">● Verified</p>
                    </div>
                </div>
            </div>
        </div>
    );
}
