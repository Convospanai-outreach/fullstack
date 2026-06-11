import { prisma } from "@/lib/db";

export type ExtensionCapturePayload = {
    source?: string;
    channel?: string;
    name?: string;
    email?: string;
    linkedinUrl?: string;
    profileUrl?: string;
    headline?: string;
    company?: string;
    role?: string;
    location?: string;
    notes?: string;
    priority?: string;
    leadType?: string;
    outreachAngle?: string;
    messageDraft?: string;
    qualification?: unknown;
    confidence?: Record<string, unknown>;
    sources?: Record<string, unknown>;
    capturedAt?: string;
};

export type ExtensionCaptureResult = {
    success: true;
    leadId: string;
    matchedExisting: boolean;
    status: string;
    message: string;
};

const LINKEDIN_HOSTS = new Set(["linkedin.com", "www.linkedin.com"]);
const CHANNEL_LINKEDIN = "LINKEDIN";

export function normalizeLinkedInProfileUrl(value: unknown): string | null {
    if (typeof value !== "string") return null;
    try {
        const parsed = new URL(value.trim());
        const hostname = parsed.hostname.toLowerCase();
        if (parsed.protocol !== "https:") return null;
        if (!LINKEDIN_HOSTS.has(hostname)) return null;
        const match = parsed.pathname.match(/\/in\/([^/?#]+)/i);
        if (!match?.[1]) return null;
        return `https://www.linkedin.com/in/${match[1].replace(/\/+$/, "")}/`;
    } catch {
        return null;
    }
}

function sanitizeText(value: unknown, maxLength: number): string | undefined {
    if (typeof value !== "string") return undefined;
    const trimmed = value.trim().replace(/\s+/g, " ");
    return trimmed ? trimmed.slice(0, maxLength) : undefined;
}

function normalizeComparable(value: unknown): string {
    return typeof value === "string"
        ? value.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim()
        : "";
}

function confidenceFor(payload: ExtensionCapturePayload, key: string): number {
    const raw = payload.confidence?.[key];
    return typeof raw === "number" ? raw : Number(raw || 0);
}

function shouldFill(existing: unknown, incoming: unknown, minConfidence = 0): boolean {
    if (typeof existing === "string" && existing.trim()) return false;
    if (incoming == null || String(incoming).trim() === "") return false;
    return minConfidence <= 0 || minConfidence >= 55;
}

async function findMatchingLead(db: any, teamId: string, payload: ExtensionCapturePayload, linkedinUrl: string | null) {
    if (linkedinUrl) {
        const byLinkedIn = await db.lead.findFirst({
            where: { teamId, linkedIn: linkedinUrl },
            include: { emails: { select: { id: true }, take: 1 }, channelStatuses: true }
        });
        if (byLinkedIn) return byLinkedIn;
    }

    const email = sanitizeText(payload.email, 320)?.toLowerCase();
    if (email) {
        const byEmail = await db.lead.findFirst({
            where: { teamId, email },
            include: { emails: { select: { id: true }, take: 1 }, channelStatuses: true }
        });
        if (byEmail) return byEmail;
    }

    const nameKey = normalizeComparable(payload.name);
    const companyKey = normalizeComparable(payload.company);
    if (nameKey && companyKey) {
        const candidates = await db.lead.findMany({
            where: {
                teamId,
                OR: [
                    { fullName: { contains: payload.name, mode: "insensitive" } },
                    { company: { contains: payload.company, mode: "insensitive" } }
                ]
            },
            take: 25,
            include: { emails: { select: { id: true }, take: 1 }, channelStatuses: true }
        });
        return candidates.find((lead: any) => (
            normalizeComparable(lead.fullName) === nameKey &&
            normalizeComparable(lead.company) === companyKey
        )) || null;
    }

    return null;
}

function resolveLeadStatus(existing: any, linkedInStatus: string, emailTouched: boolean) {
    const current = existing?.status || "NEW";
    if (["WON", "LOST", "REPLIED", "FOLLOW_UP_NEEDED"].includes(current)) return current;
    const emailContacted = emailTouched || ["CONTACTED", "EMAIL_SENT", "MULTI_CHANNEL_ENGAGED", "MULTI_CHANNEL_CONTACTED"].includes(current);
    if (emailContacted && linkedInStatus === "CONTACTED") return "MULTI_CHANNEL_CONTACTED";
    if (emailContacted && ["CAPTURED", "DRAFTED"].includes(linkedInStatus)) return "MULTI_CHANNEL_ENGAGED";
    if (linkedInStatus === "CONTACTED") return "CONTACTED";
    return "LINKEDIN_CAPTURED";
}

async function upsertChannelStatus(db: any, leadId: string, channel: string, status: string, now: Date) {
    return db.leadChannelStatus.upsert({
        where: { leadId_channel: { leadId, channel } },
        update: { status, lastActivityAt: now },
        create: { leadId, channel, status, lastActivityAt: now }
    });
}

async function addActivity(db: any, input: {
    leadId: string;
    channel: string;
    type: string;
    title: string;
    notes?: string;
    metadata?: unknown;
    createdBy?: string;
}) {
    return db.leadActivity.create({
        data: {
            leadId: input.leadId,
            channel: input.channel,
            type: input.type,
            title: input.title,
            notes: input.notes,
            metadata: input.metadata,
            createdBy: input.createdBy
        }
    });
}

export async function syncLinkedInExtensionCapture(params: {
    teamId: string;
    userId: string;
    payload: ExtensionCapturePayload;
}): Promise<ExtensionCaptureResult> {
    const db = prisma as any;
    const now = new Date();
    const payload = params.payload;
    const linkedinUrl = normalizeLinkedInProfileUrl(payload.linkedinUrl || payload.profileUrl);
    if (!linkedinUrl) throw new Error("Valid LinkedIn profile URL is required");

    const existing = await findMatchingLead(db, params.teamId, payload, linkedinUrl);
    const matchedExisting = Boolean(existing);
    const linkedInStatus = payload.messageDraft ? "DRAFTED" : "CAPTURED";
    const emailTouched = Boolean(existing?.emails?.length) ||
        ["EMAIL_SENT", "CONTACTED", "MULTI_CHANNEL_ENGAGED", "MULTI_CHANNEL_CONTACTED"].includes(existing?.status || "") ||
        Boolean(existing?.channelStatuses?.some((item: any) => item.channel === "EMAIL" && item.status !== "NOT_STARTED"));
    const status = resolveLeadStatus(existing, linkedInStatus, emailTouched);
    const enrichedData = {
        ...(existing?.enrichedData && typeof existing.enrichedData === "object" && !Array.isArray(existing.enrichedData) ? existing.enrichedData : {}),
        extensionCapture: {
            source: payload.source || "chrome_extension",
            channel: payload.channel || CHANNEL_LINKEDIN,
            leadType: sanitizeText(payload.leadType, 80),
            outreachAngle: sanitizeText(payload.outreachAngle, 160),
            messageDraft: sanitizeText(payload.messageDraft, 4000),
            qualification: payload.qualification || {},
            confidence: payload.confidence || {},
            sources: payload.sources || {},
            capturedAt: sanitizeText(payload.capturedAt, 80) || now.toISOString()
        }
    };

    const leadData: any = {
        linkedIn: existing?.linkedIn || linkedinUrl,
        status,
        pipelineState: status.startsWith("MULTI_CHANNEL") ? "WARM" : (existing?.pipelineState || "COLD"),
        enrichedData
    };

    if (shouldFill(existing?.fullName, payload.name, confidenceFor(payload, "name"))) {
        leadData.fullName = sanitizeText(payload.name, 200);
    }
    if (shouldFill(existing?.company, payload.company, confidenceFor(payload, "company"))) {
        leadData.company = sanitizeText(payload.company, 200);
    }
    if (shouldFill(existing?.jobTitle, payload.role || payload.headline, confidenceFor(payload, "currentRole") || confidenceFor(payload, "headline"))) {
        leadData.jobTitle = sanitizeText(payload.role || payload.headline, 240);
    }
    if (shouldFill(existing?.location, payload.location, confidenceFor(payload, "location"))) {
        leadData.location = sanitizeText(payload.location, 140);
    }
    if (!existing?.email && payload.email) {
        leadData.email = sanitizeText(payload.email, 320)?.toLowerCase();
    }

    const lead = existing
        ? await db.lead.update({ where: { id: existing.id }, data: leadData })
        : await db.lead.create({
            data: {
                fullName: sanitizeText(payload.name, 200) || "Unknown LinkedIn Lead",
                email: sanitizeText(payload.email, 320)?.toLowerCase(),
                linkedIn: linkedinUrl,
                company: sanitizeText(payload.company, 200),
                jobTitle: sanitizeText(payload.role || payload.headline, 240),
                location: sanitizeText(payload.location, 140),
                status,
                priority: sanitizeText(payload.priority, 40),
                source: "chrome_extension",
                pipelineState: status.startsWith("MULTI_CHANNEL") ? "WARM" : "COLD",
                teamId: params.teamId,
                enrichedData
            }
        });

    if (emailTouched) {
        await upsertChannelStatus(db, lead.id, "EMAIL", "CONTACTED", now);
    }
    await upsertChannelStatus(db, lead.id, CHANNEL_LINKEDIN, linkedInStatus, now);
    await addActivity(db, {
        leadId: lead.id,
        channel: CHANNEL_LINKEDIN,
        type: "LINKEDIN_PROFILE_CAPTURED",
        title: matchedExisting ? "LinkedIn profile captured and merged" : "LinkedIn profile captured",
        notes: sanitizeText(payload.notes, 4000),
        metadata: enrichedData.extensionCapture,
        createdBy: params.userId
    });

    await db.systemEvent.create({
        data: {
            teamId: params.teamId,
            actorId: params.userId,
            type: "SYSTEM",
            name: "LINKEDIN_EXTENSION_CAPTURE_SYNCED",
            timestamp: now,
            payload: {
                leadId: lead.id,
                matchedExisting,
                linkedinUrl,
                status
            }
        }
    }).catch(() => null);

    return {
        success: true,
        leadId: lead.id,
        matchedExisting,
        status,
        message: matchedExisting ? "LinkedIn capture synced to existing lead" : "LinkedIn capture created new lead"
    };
}

export async function markLinkedInOutreachDone(params: {
    teamId: string;
    userId: string;
    leadId: string;
    notes?: string;
}) {
    const db = prisma as any;
    const now = new Date();
    const lead = await db.lead.findFirst({
        where: { id: params.leadId, teamId: params.teamId },
        include: {
            channelStatuses: true,
            emails: { select: { id: true }, take: 1 }
        }
    });
    if (!lead) throw new Error("Lead not found");

    const emailTouched = Boolean(lead.emails?.length) ||
        ["EMAIL_SENT", "CONTACTED", "MULTI_CHANNEL_ENGAGED", "MULTI_CHANNEL_CONTACTED"].includes(lead.status || "") ||
        Boolean(lead.channelStatuses?.some((item: any) => item.channel === "EMAIL" && item.status !== "NOT_STARTED"));
    const status = resolveLeadStatus(lead, "CONTACTED", emailTouched);

    await upsertChannelStatus(db, lead.id, CHANNEL_LINKEDIN, "CONTACTED", now);
    if (emailTouched) await upsertChannelStatus(db, lead.id, "EMAIL", "CONTACTED", now);
    await addActivity(db, {
        leadId: lead.id,
        channel: CHANNEL_LINKEDIN,
        type: "LINKEDIN_OUTREACH_DONE",
        title: "LinkedIn outreach marked as done",
        notes: sanitizeText(params.notes, 4000),
        metadata: { markedAt: now.toISOString() },
        createdBy: params.userId
    });

    const updated = await db.lead.update({
        where: { id: lead.id },
        data: {
            status,
            pipelineState: status === "MULTI_CHANNEL_CONTACTED" ? "WARM" : lead.pipelineState
        }
    });

    return {
        success: true,
        leadId: updated.id,
        status: updated.status,
        message: "LinkedIn outreach marked as done"
    };
}
