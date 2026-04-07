"use client";

import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

export type IntelSignal = {
    id: string;
    companyName: string;
    industry: string;
    buyingStage: string;
    intentScore: number;
    signalStrength: number; // 0-100
    whyNow: string;
    whatTheyNeed: string;
    recommendedAction: string;
    temperatureBand: "HOT" | "WARM" | "COLD";
    verityTier: string | null;
    isTriangulated: boolean;
    receivedAt: string;
    event: string;
    matchStatus: "MATCHED" | "UNMATCHED";
    matchConfidence: "HIGH" | "MEDIUM" | "NONE";
    safeForAutomation: boolean;
    trustedForKnowledge: boolean;
    signatureVerified: boolean;
    verificationMode: "HMAC_VERIFIED" | "SHARED_KEY_ONLY";
};

function clampText(value: string, max = 140) {
    const trimmed = (value || "").trim();
    if (trimmed.length <= max) return trimmed;
    return `${trimmed.slice(0, max - 1)}…`;
}

function temperatureVariant(band: IntelSignal["temperatureBand"]) {
    if (band === "HOT") return "danger";
    if (band === "WARM") return "warning";
    return "info";
}

function matchVariant(status: IntelSignal["matchStatus"]) {
    return status === "MATCHED" ? "success" : "secondary";
}

export function IntelCapsule({
    signal,
    selected,
    onSelect,
    className,
}: {
    signal: IntelSignal;
    selected?: boolean;
    onSelect?: (id: string) => void;
    className?: string;
}) {
    const primary = signal.whyNow || signal.whatTheyNeed || signal.recommendedAction || "";

    const content = (
        <div
            className={cn(
                "rounded-2xl border bg-black/20 p-4 transition",
                selected ? "border-cyan-500/40 ring-1 ring-cyan-500/20" : "border-white/10 hover:border-white/20",
                className
            )}
        >
            <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                <div className="space-y-1">
                    <div className="text-sm font-semibold text-white">{signal.companyName}</div>
                    <div className="text-xs text-gray-400">
                        {signal.industry} • {new Date(signal.receivedAt).toLocaleString()}
                    </div>
                </div>

                <div className="flex flex-wrap items-center gap-2">
                    <Badge variant={temperatureVariant(signal.temperatureBand)}>{signal.temperatureBand}</Badge>
                    <Badge variant="secondary">{signal.buyingStage}</Badge>
                    <Badge variant="outline">{signal.intentScore}/100 intent</Badge>
                    <Badge variant="outline">{signal.signalStrength}/100 strength</Badge>
                    <Badge variant={matchVariant(signal.matchStatus)}>{signal.matchStatus}</Badge>
                </div>
            </div>

            <div className="mt-3 grid gap-2">
                {primary && (
                    <div className="text-sm text-gray-200">
                        <span className="text-gray-400">Why now:</span> {clampText(primary, 170)}
                    </div>
                )}
                {signal.recommendedAction && (
                    <div className="text-sm text-gray-200">
                        <span className="text-gray-400">Suggested:</span> {clampText(signal.recommendedAction, 170)}
                    </div>
                )}
            </div>

            <div className="mt-3 flex flex-wrap items-center gap-2 text-xs text-gray-500">
                {signal.signatureVerified && <span>HMAC verified</span>}
                {signal.verityTier && <span>• {signal.verityTier}</span>}
                {signal.isTriangulated && <span>• triangulated</span>}
                {signal.safeForAutomation && <span>• automation-ready</span>}
                {signal.trustedForKnowledge && <span>• knowledge-ready</span>}
                {signal.matchConfidence && <span>• match: {signal.matchConfidence}</span>}
            </div>
        </div>
    );

    if (!onSelect) return content;

    return (
        <button type="button" onClick={() => onSelect(signal.id)} className="text-left">
            {content}
        </button>
    );
}

