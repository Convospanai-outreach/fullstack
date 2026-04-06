import crypto from "crypto";
import { prisma } from "@/lib/db";
import { JobQueue } from "@/lib/queue";

const NETJANA_SOURCE = "NetJana.AI / ConvoSpan Intel";
const NETJANA_EVENTS = ["LEAD_CARD_READY", "SIGNAL_INGESTED", "INTENT_UPDATED"] as const;
const BUYING_STAGES = ["AWARENESS", "CONSIDERATION", "DECISION", "UNKNOWN"] as const;
const VERITY_TIERS = ["TIER_1", "TIER_2"] as const;
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export type NetjanaEventType = (typeof NETJANA_EVENTS)[number];
export type NetjanaBuyingStage = (typeof BUYING_STAGES)[number];
export type NetjanaVerityTier = (typeof VERITY_TIERS)[number];
export type NetjanaMatchConfidence = "HIGH" | "MEDIUM" | "NONE";
export type NetjanaMatchStatus = "MATCHED" | "UNMATCHED";
export type NetjanaVerificationMode = "HMAC_VERIFIED" | "SHARED_KEY_ONLY";

export interface NetjanaLeadPayload {
    lead_id: string;
    company_name: string;
    geo_state?: string;
    sector?: string;
    source_id?: string;
    buying_stage?: NetjanaBuyingStage;
    procurement_category?: string;
    intent_score: number;
    verity_tier?: NetjanaVerityTier;
    is_triangulated?: boolean;
    card_why_now?: string;
    card_what_they_need?: string;
    card_do_this?: string;
    created_at?: string;
}

export interface NetjanaIntelPayload {
    event: NetjanaEventType;
    source: string;
    timestamp: string;
    lead: NetjanaLeadPayload;
    campaign_id?: string;
    meta?: {
        pushed_by?: string;
        retry_attempt?: number;
        [key: string]: unknown;
    };
}

export interface NormalizedNetjanaSignal {
    signalId: string;
    event: NetjanaEventType;
    externalLeadId: string;
    companyName: string;
    industry: string | null;
    geoState: string | null;
    buyingStage: NetjanaBuyingStage;
    intentScore: number;
    signalStrength: number;
    strengthPercent: number;
    verityTier: NetjanaVerityTier | null;
    isTriangulated: boolean;
    whyNow: string;
    whatTheyNeed: string;
    recommendedAction: string;
    campaignId: string | null;
    timestamp: string;
    temperatureBand: "HOT" | "WARM" | "COLD";
    source: string;
    sourceId: string | null;
    procurementCategory: string | null;
    matchConfidence: NetjanaMatchConfidence;
    matchStatus: NetjanaMatchStatus;
    matchedLeadId: string | null;
    safeForAutomation: boolean;
    trustedForKnowledge: boolean;
    signatureVerified: boolean;
    verificationMode: NetjanaVerificationMode;
}

type NetjanaIngestOptions = {
    signatureVerified?: boolean;
};

function clamp(value: number, min: number, max: number) {
    return Math.min(max, Math.max(min, value));
}

function isIsoDateTime(value: unknown) {
    if (typeof value !== "string") {
        return false;
    }

    const parsed = new Date(value);
    return !Number.isNaN(parsed.getTime()) && parsed.toISOString() === value;
}

function isUuid(value: unknown) {
    return typeof value === "string" && UUID_PATTERN.test(value);
}

function isNonEmptyString(value: unknown, maxLength = 500) {
    return typeof value === "string" && value.trim().length > 0 && value.trim().length <= maxLength;
}

function isOptionalString(value: unknown, maxLength = 500) {
    return value === undefined || value === null || (typeof value === "string" && value.trim().length <= maxLength);
}

function sanitizeExternalText(value: string | undefined, maxLength: number) {
    return (value || "")
        .replace(/[\u0000-\u001F\u007F]/g, " ")
        .replace(/\s+/g, " ")
        .trim()
        .slice(0, maxLength);
}

function normalizeCompanyName(value: string) {
    return value.toLowerCase().replace(/[^a-z0-9]+/g, "");
}

function buildSignalUrl(companyName: string) {
    const slug = companyName.toLowerCase().trim().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
    return `netjana://${slug || "unknown-company"}`;
}

function toRecord(value: unknown) {
    return typeof value === "object" && value !== null ? value as Record<string, unknown> : {};
}

function toMetadataSignalId(value: unknown) {
    const record = toRecord(value);
    return typeof record.signalId === "string" ? record.signalId : null;
}

function computeSignalStrength(payload: NetjanaIntelPayload) {
    const timestamp = payload.lead.created_at || payload.timestamp;
    const eventTime = new Date(timestamp);
    const ageInDays = Number.isNaN(eventTime.getTime())
        ? 0
        : Math.max(0, (Date.now() - eventTime.getTime()) / (1000 * 60 * 60 * 24));
    const freshnessFactor = Math.exp(-ageInDays / 30);
    const intentScore = clamp(payload.lead.intent_score || 0, 0, 100);
    const confidenceScore = clamp(intentScore / 100, 0, 1);
    const tierMultiplier = payload.lead.verity_tier === "TIER_1" ? 1.1 : 1;
    const triangulationMultiplier = payload.lead.is_triangulated ? 1.1 : 1;
    const signalStrength = clamp(confidenceScore * freshnessFactor * tierMultiplier * triangulationMultiplier, 0, 1);
    const strengthPercent = Math.round(signalStrength * 100);

    return {
        timestamp,
        intentScore,
        signalStrength,
        strengthPercent,
    };
}

function computeBaseTrust(signal: NormalizedNetjanaSignal) {
    const verifiedSignal = signal.signatureVerified && signal.verityTier === "TIER_1" && signal.isTriangulated;
    const trustedForKnowledge = verifiedSignal
        && signal.strengthPercent >= 60
        && Boolean(signal.whyNow || signal.whatTheyNeed);

    const safeForAutomation = trustedForKnowledge
        && signal.strengthPercent >= 75
        && signal.matchConfidence !== "NONE";

    return {
        trustedForKnowledge,
        safeForAutomation,
    };
}

export function shouldQueueNetjanaFollowup(signal: NormalizedNetjanaSignal) {
    if (!signal.safeForAutomation) {
        return false;
    }

    return signal.temperatureBand === "HOT" || signal.strengthPercent >= 75;
}

export function verifyNetjanaSignature(rawBody: string, signature: string | null, secret: string) {
    if (!signature) {
        return false;
    }

    const expected = crypto.createHmac("sha256", secret).update(rawBody).digest("hex");
    const received = signature.trim();

    if (!/^[0-9a-f]{64}$/i.test(received) || expected.length !== received.length) {
        return false;
    }

    return crypto.timingSafeEqual(Buffer.from(expected, "utf8"), Buffer.from(received, "utf8"));
}

export function validateNetjanaPayload(payload: unknown): payload is NetjanaIntelPayload {
    if (!payload || typeof payload !== "object") {
        return false;
    }

    const data = payload as Record<string, unknown>;
    const lead = data["lead"];
    if (!lead || typeof lead !== "object") {
        return false;
    }

    const leadData = lead as Record<string, unknown>;
    const validEvent = NETJANA_EVENTS.includes(String(data["event"]) as NetjanaEventType);
    const validSource = data["source"] === NETJANA_SOURCE;
    const validTimestamp = isIsoDateTime(data["timestamp"]);
    const validLeadId = isUuid(leadData["lead_id"]);
    const validCompany = isNonEmptyString(leadData["company_name"], 160);
    const validIntentScore = Number.isInteger(leadData["intent_score"])
        && Number(leadData["intent_score"]) >= 0
        && Number(leadData["intent_score"]) <= 100;
    const validBuyingStage = leadData["buying_stage"] === undefined
        || BUYING_STAGES.includes(String(leadData["buying_stage"]) as NetjanaBuyingStage);
    const validVerityTier = leadData["verity_tier"] === undefined
        || VERITY_TIERS.includes(String(leadData["verity_tier"]) as NetjanaVerityTier);
    const validCreatedAt = leadData["created_at"] === undefined || isIsoDateTime(leadData["created_at"]);

    return validEvent
        && validSource
        && validTimestamp
        && validLeadId
        && validCompany
        && validIntentScore
        && validBuyingStage
        && validVerityTier
        && validCreatedAt
        && isOptionalString(leadData["geo_state"], 80)
        && isOptionalString(leadData["sector"], 120)
        && isOptionalString(leadData["source_id"], 120)
        && isOptionalString(leadData["procurement_category"], 160)
        && isOptionalString(leadData["card_why_now"], 400)
        && isOptionalString(leadData["card_what_they_need"], 300)
        && isOptionalString(leadData["card_do_this"], 240)
        && (leadData["is_triangulated"] === undefined || typeof leadData["is_triangulated"] === "boolean")
        && (data["campaign_id"] === undefined || isOptionalString(data["campaign_id"], 120))
        && (
            data["meta"] === undefined
            || (
                typeof data["meta"] === "object"
                && data["meta"] !== null
                && (
                    (data["meta"] as Record<string, unknown>)["retry_attempt"] === undefined
                    || Number.isInteger((data["meta"] as Record<string, unknown>)["retry_attempt"])
                )
                && isOptionalString((data["meta"] as Record<string, unknown>)["pushed_by"], 80)
            )
        );
}

export function createNetjanaSignalId(teamId: string, payload: NetjanaIntelPayload) {
    const hash = crypto
        .createHash("sha256")
        .update([teamId, payload.lead.lead_id].join("|"))
        .digest("hex")
        .slice(0, 24);

    return `netjana_${hash}`;
}

export function normalizeNetjanaSignal(
    teamId: string,
    payload: NetjanaIntelPayload,
    options: NetjanaIngestOptions = {}
): NormalizedNetjanaSignal {
    const { timestamp, intentScore, signalStrength, strengthPercent } = computeSignalStrength(payload);
    const buyingStage = payload.lead.buying_stage || "UNKNOWN";
    const temperatureBand = strengthPercent >= 75
        ? "HOT"
        : strengthPercent >= 50
            ? "WARM"
            : "COLD";
    const signatureVerified = Boolean(options.signatureVerified);
    const signal: NormalizedNetjanaSignal = {
        signalId: createNetjanaSignalId(teamId, payload),
        event: payload.event,
        externalLeadId: payload.lead.lead_id,
        companyName: sanitizeExternalText(payload.lead.company_name, 160),
        industry: sanitizeExternalText(payload.lead.sector, 120) || null,
        geoState: sanitizeExternalText(payload.lead.geo_state, 80) || null,
        buyingStage,
        intentScore,
        signalStrength,
        strengthPercent,
        verityTier: payload.lead.verity_tier || null,
        isTriangulated: Boolean(payload.lead.is_triangulated),
        whyNow: sanitizeExternalText(payload.lead.card_why_now, 400),
        whatTheyNeed: sanitizeExternalText(payload.lead.card_what_they_need, 300),
        recommendedAction: sanitizeExternalText(payload.lead.card_do_this, 240),
        campaignId: payload.campaign_id || null,
        timestamp,
        temperatureBand,
        source: NETJANA_SOURCE,
        sourceId: sanitizeExternalText(payload.lead.source_id, 120) || null,
        procurementCategory: sanitizeExternalText(payload.lead.procurement_category, 160) || null,
        matchConfidence: "NONE",
        matchStatus: "UNMATCHED",
        matchedLeadId: null,
        safeForAutomation: false,
        trustedForKnowledge: false,
        signatureVerified,
        verificationMode: signatureVerified ? "HMAC_VERIFIED" : "SHARED_KEY_ONLY",
    };

    const trust = computeBaseTrust(signal);
    signal.safeForAutomation = trust.safeForAutomation;
    signal.trustedForKnowledge = trust.trustedForKnowledge;
    return signal;
}

function buildWikiContent(signal: NormalizedNetjanaSignal) {
    return [
        `# ${signal.companyName} Buyer Intent`,
        "",
        "> External Intel Summary",
        "> This note came from Netjana / ConvoSpan Intel and should be treated as verified external signal context, not a first-party customer statement.",
        "",
        `Industry: ${signal.industry || "Unknown"}`,
        `Buying stage: ${signal.buyingStage}`,
        `Intent score: ${signal.intentScore}/100`,
        `Signal strength: ${signal.strengthPercent}/100 (${signal.temperatureBand})`,
        `Location: ${signal.geoState || "Unknown"}`,
        `Triangulated: ${signal.isTriangulated ? "Yes" : "No"}`,
        `Verity tier: ${signal.verityTier || "Unknown"}`,
        `Verification: ${signal.signatureVerified ? "HMAC verified" : "API key only"}`,
        "",
        "Why now:",
        signal.whyNow || "Not provided.",
        "",
        "What they need:",
        signal.whatTheyNeed || "Not provided.",
        "",
        "Recommended action:",
        signal.recommendedAction || "Not provided.",
        "",
        `Source: ${signal.source}`,
        `Received at: ${signal.timestamp}`,
    ].join("\n");
}

function buildSignalContent(signal: NormalizedNetjanaSignal) {
    return [
        signal.whyNow,
        signal.whatTheyNeed,
    ]
        .filter(Boolean)
        .join(" | ")
        .trim() || `${signal.companyName} buyer-intent signal`;
}

function buildFollowupReason(signal: NormalizedNetjanaSignal) {
    return [
        `${signal.companyName} matched a ${signal.temperatureBand.toLowerCase()} Netjana signal (${signal.strengthPercent}/100)`,
        signal.whyNow,
    ].filter(Boolean).join(" - ");
}

function buildAutomationState(signal: NormalizedNetjanaSignal, extras: Record<string, unknown> = {}) {
    return {
        signalId: signal.signalId,
        signalStrength: signal.strengthPercent,
        temperatureBand: signal.temperatureBand,
        matchStatus: signal.matchStatus,
        matchConfidence: signal.matchConfidence,
        safeForAutomation: signal.safeForAutomation,
        trustedForKnowledge: signal.trustedForKnowledge,
        signatureVerified: signal.signatureVerified,
        queuedAt: new Date().toISOString(),
        ...extras,
    };
}

export async function queueNetjanaFollowup(
    teamId: string,
    signal: NormalizedNetjanaSignal,
    lead: { id: string; campaignId?: string | null } | null
) {
    if (!signal.safeForAutomation) {
        return { queued: false, reason: "review_required" as const };
    }

    if (!shouldQueueNetjanaFollowup(signal)) {
        return { queued: false, reason: "signal_not_hot" as const };
    }

    const targetCampaignId = lead?.campaignId || signal.campaignId || null;
    if (!lead?.id && !targetCampaignId) {
        return { queued: false, reason: "no_target" as const };
    }

    const job = await JobQueue.enqueue(
        "INTEL_FOLLOWUP_REFRESH",
        {
            teamId,
            signal,
            signalId: signal.signalId,
            leadId: lead?.id,
            campaignId: targetCampaignId || undefined,
            companyName: signal.companyName,
            externalLeadId: signal.externalLeadId,
        },
        {
            teamId,
            priority: 4,
            idempotencyKey: `netjana_followup_${signal.signalId}`,
            requireIdempotency: true,
            executionMode: "saas_only",
            targetRuntime: "saas_only",
        }
    );

    return { queued: true, jobId: job.id };
}

async function ensureIntelKnowledgeBase(teamId: string) {
    let knowledgeBase = await prisma.knowledgeBase.findFirst({
        where: {
            teamId,
            name: "Netjana Intelligence",
        },
        select: { id: true },
    });

    if (!knowledgeBase) {
        knowledgeBase = await prisma.knowledgeBase.create({
            data: {
                teamId,
                name: "Netjana Intelligence",
                description: "Buyer-intent signals and company context imported from Netjana / ConvoSpan Intel.",
            },
            select: { id: true },
        });
    }

    return knowledgeBase;
}

export async function findLeadForSignal(teamId: string, signal: NormalizedNetjanaSignal) {
    const targetCompany = normalizeCompanyName(signal.companyName);

    if (signal.campaignId) {
        const campaignLeads = await prisma.lead.findMany({
            where: {
                teamId,
                campaignId: signal.campaignId,
                company: { not: null },
            },
            take: 100,
        });

        const exactCampaignLead = campaignLeads.find((item) => item.company?.toLowerCase() === signal.companyName.toLowerCase());
        if (exactCampaignLead) {
            return { lead: exactCampaignLead, matchConfidence: "HIGH" as const };
        }

        const normalizedCampaignLead = campaignLeads.find((item) => item.company && normalizeCompanyName(item.company) === targetCompany);
        if (normalizedCampaignLead) {
            return { lead: normalizedCampaignLead, matchConfidence: "HIGH" as const };
        }
    }

    const exactLead = await prisma.lead.findFirst({
        where: {
            teamId,
            company: {
                equals: signal.companyName,
                mode: "insensitive",
            },
        },
    });

    if (exactLead) {
        return { lead: exactLead, matchConfidence: "MEDIUM" as const };
    }

    const candidates = await prisma.lead.findMany({
        where: {
            teamId,
            company: { not: null },
        },
        select: {
            id: true,
            company: true,
        },
        take: 400,
    });

    const candidate = candidates.find((item) => item.company && normalizeCompanyName(item.company) === targetCompany);
    if (!candidate) {
        return { lead: null, matchConfidence: "NONE" as const };
    }

    const lead = await prisma.lead.findUnique({ where: { id: candidate.id } });
    return { lead, matchConfidence: lead ? "MEDIUM" as const : "NONE" as const };
}

async function upsertIntelKnowledgeItem(teamId: string, signal: NormalizedNetjanaSignal) {
    if (!signal.trustedForKnowledge) {
        return null;
    }

    const knowledgeBase = await ensureIntelKnowledgeBase(teamId);
    const recentItems = await prisma.knowledgeItem.findMany({
        where: { knowledgeBaseId: knowledgeBase.id },
        select: { id: true, metadata: true },
        orderBy: { createdAt: "desc" },
        take: 300,
    });

    const existingItem = recentItems.find((item) => toMetadataSignalId(item.metadata) === signal.signalId);
    const data = {
        knowledgeBaseId: knowledgeBase.id,
        content: buildWikiContent(signal),
        metadata: {
            provider: "netjana-intel",
            signalId: signal.signalId,
            companyName: signal.companyName,
            buyingStage: signal.buyingStage,
            intentScore: signal.intentScore,
            signalStrength: signal.strengthPercent,
            campaignId: signal.campaignId,
            receivedAt: signal.timestamp,
            trustedForKnowledge: true,
            signatureVerified: signal.signatureVerified,
            matchStatus: signal.matchStatus,
            matchConfidence: signal.matchConfidence,
        },
    };

    if (existingItem) {
        return prisma.knowledgeItem.update({
            where: { id: existingItem.id },
            data: {
                content: data.content,
                metadata: data.metadata,
            },
        });
    }

    return prisma.knowledgeItem.create({ data });
}

export async function ingestNetjanaSignal(
    teamId: string,
    payload: NetjanaIntelPayload,
    options: NetjanaIngestOptions = {}
) {
    const signal = normalizeNetjanaSignal(teamId, payload, options);
    const existingSignal = await prisma.shadowSignal.findUnique({
        where: { id: signal.signalId },
        select: { id: true },
    });

    const { lead, matchConfidence } = await findLeadForSignal(teamId, signal);
    signal.matchConfidence = matchConfidence;
    signal.matchStatus = lead ? "MATCHED" : "UNMATCHED";
    signal.matchedLeadId = lead?.id || null;

    const trust = computeBaseTrust(signal);
    signal.trustedForKnowledge = trust.trustedForKnowledge;
    signal.safeForAutomation = trust.safeForAutomation;

    const rawPayload = payload as unknown as Record<string, unknown>;
    const marketContext = {
        source: "netjana-intel",
        companyName: signal.companyName,
        industry: signal.industry,
        buyingStage: signal.buyingStage,
        intentScore: signal.intentScore,
        signalStrength: signal.strengthPercent,
        whyNow: signal.whyNow,
        verificationMode: signal.verificationMode,
        signatureVerified: signal.signatureVerified,
        matchStatus: signal.matchStatus,
        matchConfidence: signal.matchConfidence,
        safeForAutomation: signal.safeForAutomation,
        trustedForKnowledge: signal.trustedForKnowledge,
        receivedAt: signal.timestamp,
    };

    const followup = await queueNetjanaFollowup(
        teamId,
        signal,
        lead ? {
            id: lead.id,
            campaignId: lead.campaignId || signal.campaignId || null,
        } : null
    );

    const signalUrl = buildSignalUrl(signal.companyName);

    await prisma.scrapingJob.upsert({
        where: { id: signal.signalId },
        update: {
            status: "COMPLETED",
            url: signalUrl,
            payload: {
                provider: "netjana-intel",
                normalized: signal,
                raw: rawPayload,
            },
            updatedAt: new Date(),
            teamId,
        },
        create: {
            id: signal.signalId,
            url: signalUrl,
            status: "COMPLETED",
            payload: {
                provider: "netjana-intel",
                normalized: signal,
                raw: rawPayload,
            },
            teamId,
        },
    });

    await prisma.shadowSignal.upsert({
        where: { id: signal.signalId },
        update: {
            source: "netjana-intel",
            url: signalUrl,
            content: buildSignalContent(signal),
            frictionScore: signal.strengthPercent,
            detectedICPs: [signal.buyingStage, signal.industry || "unknown"].filter(Boolean),
            isWarmLead: signal.strengthPercent >= 60,
            metadata: {
                provider: "netjana-intel",
                ...signal,
                rawPayloadTrusted: false,
            },
            leadId: lead?.id || null,
            teamId,
        },
        create: {
            id: signal.signalId,
            source: "netjana-intel",
            url: signalUrl,
            content: buildSignalContent(signal),
            frictionScore: signal.strengthPercent,
            detectedICPs: [signal.buyingStage, signal.industry || "unknown"].filter(Boolean),
            isWarmLead: signal.strengthPercent >= 60,
            metadata: {
                provider: "netjana-intel",
                ...signal,
                rawPayloadTrusted: false,
            },
            leadId: lead?.id || null,
            teamId,
        },
    });

    if (lead) {
        const currentMarketContext = toRecord(lead.marketContext);
        const currentEnrichedData = toRecord(lead.enrichedData);
        const currentNetjana = toRecord(currentEnrichedData.netjana);
        const existingIntentScore = typeof lead.intentScore === "number" ? lead.intentScore : 0;
        const isHotSignal = shouldQueueNetjanaFollowup(signal);

        await prisma.lead.update({
            where: { id: lead.id },
            data: {
                intentScore: Math.max(existingIntentScore, signal.intentScore / 100),
                lastScoredAt: new Date(),
                pipelineState: isHotSignal ? "HOT" : lead.pipelineState,
                pipelineStateChangedAt: isHotSignal ? new Date() : lead.pipelineStateChangedAt,
                hotAt: isHotSignal && !lead.hotAt ? new Date() : lead.hotAt,
                marketContext: {
                    ...currentMarketContext,
                    netjana: marketContext,
                },
                enrichedData: {
                    ...currentEnrichedData,
                    netjana: {
                        ...currentNetjana,
                        companyName: signal.companyName,
                        industry: signal.industry,
                        buyingStage: signal.buyingStage,
                        intentScore: signal.intentScore,
                        signalStrength: signal.strengthPercent,
                        whyNow: signal.whyNow,
                        whatTheyNeed: signal.whatTheyNeed,
                        recommendedAction: signal.recommendedAction,
                        verityTier: signal.verityTier,
                        isTriangulated: signal.isTriangulated,
                        matchStatus: signal.matchStatus,
                        matchConfidence: signal.matchConfidence,
                        signatureVerified: signal.signatureVerified,
                        verificationMode: signal.verificationMode,
                        safeForAutomation: signal.safeForAutomation,
                        trustedForKnowledge: signal.trustedForKnowledge,
                        campaignId: signal.campaignId,
                        receivedAt: signal.timestamp,
                        automation: buildAutomationState(signal, {
                            status: followup.queued ? "queued" : "review_required",
                            followupJobId: followup.queued ? followup.jobId : null,
                            reason: followup.queued ? buildFollowupReason(signal) : followup.reason,
                        }),
                    },
                },
            },
        });
    }

    await upsertIntelKnowledgeItem(teamId, signal);

    return {
        signal,
        leadId: lead?.id || null,
        campaignId: lead?.campaignId || signal.campaignId || null,
        isDuplicate: Boolean(existingSignal),
        followup,
    };
}
