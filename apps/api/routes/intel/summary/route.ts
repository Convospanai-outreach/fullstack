import { NextResponse } from "next/server";
import { getCurrentContext } from "@/lib/auth";
import { prisma } from "@/lib/db";

type SignalMetadata = {
    companyName?: string;
    industry?: string | null;
    buyingStage?: string;
    intentScore?: number;
    signalStrength?: number;
    strengthPercent?: number;
    whyNow?: string;
    whatTheyNeed?: string;
    recommendedAction?: string;
    temperatureBand?: string;
    verityTier?: string | null;
    isTriangulated?: boolean;
    timestamp?: string;
    campaignId?: string | null;
    event?: string;
    matchStatus?: "MATCHED" | "UNMATCHED";
    matchConfidence?: "HIGH" | "MEDIUM" | "NONE";
    safeForAutomation?: boolean;
    trustedForKnowledge?: boolean;
    signatureVerified?: boolean;
    verificationMode?: "HMAC_VERIFIED" | "SHARED_KEY_ONLY";
};

function safeMetadata(value: unknown): SignalMetadata {
    return typeof value === "object" && value !== null ? value as SignalMetadata : {};
}

function feedStatusFromDate(lastReceivedAt?: string | null) {
    if (!lastReceivedAt) {
        return {
            status: "offline",
            label: "No feed yet",
        };
    }

    const ageMs = Date.now() - new Date(lastReceivedAt).getTime();
    if (Number.isNaN(ageMs)) {
        return {
            status: "stale",
            label: "Timestamp invalid",
        };
    }

    if (ageMs <= 1000 * 60 * 30) {
        return {
            status: "active",
            label: "Feed active",
        };
    }

    if (ageMs <= 1000 * 60 * 60 * 24) {
        return {
            status: "stale",
            label: "Feed stale",
        };
    }

    return {
        status: "offline",
        label: "Feed quiet",
    };
}

function securityStatus() {
    const hmacSecret = process.env["NETJANA_HMAC_SECRET"] || process.env["HMAC_SECRET"] || "";

    if (hmacSecret) {
        return {
            status: "verified",
            label: "HMAC protected",
            detail: "Incoming payloads are signature-verified before ingest.",
        };
    }

    return {
        status: "shared_key",
        label: "API key only",
        detail: "Signals ingest with API-key auth only; they are stored for review and not trusted for automation by default.",
    };
}

export async function GET() {
    const { userId, teamId } = await getCurrentContext();
    if (!userId || !teamId) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    try {
        const [totalSignals, signals] = await Promise.all([
            prisma.shadowSignal.count({
                where: {
                    teamId,
                    source: "netjana-intel",
                },
            }),
            prisma.shadowSignal.findMany({
                where: {
                    teamId,
                    source: "netjana-intel",
                },
                orderBy: { createdAt: "desc" },
                select: {
                    id: true,
                    content: true,
                    createdAt: true,
                    metadata: true,
                },
            }),
        ]);

        const lastReceivedAt = signals[0]?.createdAt?.toISOString?.() || null;
        const feed = {
            ...feedStatusFromDate(lastReceivedAt),
            lastReceivedAt,
        };
        const security = securityStatus();

        const industryMap = new Map<string, { name: string; count: number; totalStrength: number }>();
        const companyMap = new Map<string, { name: string; count: number; totalStrength: number; maxIntent: number; lastReceivedAt: string | null }>();
        const stageMap = new Map<string, number>();

        let totalStrength = 0;
        let totalIntent = 0;
        let buyReadySignals = 0;
        let matchedSignals = 0;
        let unmatchedSignals = 0;
        let automationReadySignals = 0;
        let knowledgeReadySignals = 0;

        const recentSignals = signals.slice(0, 12).map((signal) => {
            const metadata = safeMetadata(signal.metadata);
            const strengthPercent = typeof metadata.strengthPercent === "number"
                ? metadata.strengthPercent
                : Math.round((metadata.signalStrength || 0) * 100);
            const matchStatus = metadata.matchStatus === "MATCHED" ? "MATCHED" : "UNMATCHED";
            return {
                id: signal.id,
                companyName: metadata.companyName || "Unknown company",
                industry: metadata.industry || "Unknown industry",
                buyingStage: metadata.buyingStage || "UNKNOWN",
                intentScore: metadata.intentScore || 0,
                signalStrength: strengthPercent,
                whyNow: metadata.whyNow || signal.content,
                whatTheyNeed: metadata.whatTheyNeed || "",
                recommendedAction: metadata.recommendedAction || "",
                temperatureBand: metadata.temperatureBand || (strengthPercent >= 75 ? "HOT" : strengthPercent >= 50 ? "WARM" : "COLD"),
                verityTier: metadata.verityTier || null,
                isTriangulated: Boolean(metadata.isTriangulated),
                receivedAt: metadata.timestamp || signal.createdAt.toISOString(),
                event: metadata.event || "LEAD_CARD_READY",
                matchStatus,
                matchConfidence: metadata.matchConfidence || "NONE",
                safeForAutomation: Boolean(metadata.safeForAutomation),
                trustedForKnowledge: Boolean(metadata.trustedForKnowledge),
                signatureVerified: Boolean(metadata.signatureVerified),
                verificationMode: metadata.verificationMode || "SHARED_KEY_ONLY",
            };
        });

        for (const signal of signals) {
            const metadata = safeMetadata(signal.metadata);
            const companyName = metadata.companyName || "Unknown company";
            const industry = metadata.industry || "Unknown industry";
            const stage = metadata.buyingStage || "UNKNOWN";
            const intentScore = typeof metadata.intentScore === "number" ? metadata.intentScore : 0;
            const strengthPercent = typeof metadata.strengthPercent === "number"
                ? metadata.strengthPercent
                : Math.round((metadata.signalStrength || 0) * 100);
            const matched = metadata.matchStatus === "MATCHED";
            const safeForAutomation = Boolean(metadata.safeForAutomation);
            const trustedForKnowledge = Boolean(metadata.trustedForKnowledge);

            totalStrength += strengthPercent;
            totalIntent += intentScore;
            if (intentScore >= 65 || stage === "CONSIDERATION" || stage === "DECISION") {
                buyReadySignals += 1;
            }
            if (matched) {
                matchedSignals += 1;
            } else {
                unmatchedSignals += 1;
            }
            if (safeForAutomation) {
                automationReadySignals += 1;
            }
            if (trustedForKnowledge) {
                knowledgeReadySignals += 1;
            }

            stageMap.set(stage, (stageMap.get(stage) || 0) + 1);

            const industryBucket = industryMap.get(industry) || { name: industry, count: 0, totalStrength: 0 };
            industryBucket.count += 1;
            industryBucket.totalStrength += strengthPercent;
            industryMap.set(industry, industryBucket);

            const companyBucket = companyMap.get(companyName) || {
                name: companyName,
                count: 0,
                totalStrength: 0,
                maxIntent: 0,
                lastReceivedAt: null,
            };
            companyBucket.count += 1;
            companyBucket.totalStrength += strengthPercent;
            companyBucket.maxIntent = Math.max(companyBucket.maxIntent, intentScore);
            companyBucket.lastReceivedAt = metadata.timestamp || signal.createdAt.toISOString();
            companyMap.set(companyName, companyBucket);
        }

        const industries = Array.from(industryMap.values())
            .map((industry) => ({
                name: industry.name,
                count: industry.count,
                averageStrength: Math.round(industry.totalStrength / industry.count),
            }))
            .sort((a, b) => b.count - a.count)
            .slice(0, 8);

        const companies = Array.from(companyMap.values())
            .map((company) => ({
                name: company.name,
                count: company.count,
                averageStrength: Math.round(company.totalStrength / company.count),
                maxIntentScore: company.maxIntent,
                lastReceivedAt: company.lastReceivedAt,
            }))
            .sort((a, b) => b.averageStrength - a.averageStrength || b.count - a.count)
            .slice(0, 8);

        const buyingStages = Array.from(stageMap.entries())
            .map(([stage, count]) => ({ stage, count }))
            .sort((a, b) => b.count - a.count);

        return NextResponse.json({
            integration: {
                feed,
                security,
            },
            totals: {
                signalsReceived: totalSignals,
                industries: industryMap.size,
                companies: companyMap.size,
                buyReadySignals,
                matchedSignals,
                unmatchedSignals,
                automationReadySignals,
                knowledgeReadySignals,
            },
            averages: {
                signalStrength: totalSignals > 0 ? Math.round(totalStrength / totalSignals) : 0,
                intentScore: totalSignals > 0 ? Math.round(totalIntent / totalSignals) : 0,
            },
            buyingStages,
            industries,
            companies,
            recentSignals,
        });
    } catch (error: any) {
        console.error("[Intel Summary] Failed to load summary", error);
        return NextResponse.json({ error: error.message || "Failed to load intel summary" }, { status: 500 });
    }
}
