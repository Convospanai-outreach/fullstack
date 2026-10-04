import { prisma } from "@/lib/db";
import { JobQueue } from "@/lib/queue";
import { logger } from "@/lib/logger";
import { canonicalLinkedInProfileUrl } from "@/lib/crm/linkedin";
import { CmfSequenceProvider, nurtureCanRunSteps } from "@/modules/creator-funnel/nurtureProvider";

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
    enrichmentQueued: boolean;
};

const CHANNEL_LINKEDIN = "LINKEDIN";

// The stored form (see lib/crm/linkedin.ts), so a capture finds the lead a CSV import created.
export const normalizeLinkedInProfileUrl = canonicalLinkedInProfileUrl;

// Queues lead enrichment (email finder, Crystal, scoring) for a lead the extension saved, when
// the team has "Enrich captured leads" on. Once per lead: the idempotency key means re-capturing
// the same person doesn't charge again. Never fails the capture itself.
export async function queueCaptureEnrichment(teamId: string, lead: { id: string; isEnriched?: boolean | null }): Promise<boolean> {
    if (lead.isEnriched) return false;
    try {
        const team = await prisma.team.findUnique({ where: { id: teamId }, select: { autoEnrichCapturedLeads: true } });
        if (!team?.autoEnrichCapturedLeads) return false;
        await JobQueue.enqueue(
            "lead_enrichment",
            { leadId: lead.id, teamId },
            { teamId, idempotencyKey: `extension_enrich_${lead.id}` }
        );
        return true;
    } catch (error) {
        logger.warn("[extension capture] couldn't queue enrichment", { leadId: lead.id, error: error instanceof Error ? error.message : error });
        return false;
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

    const enrichmentQueued = await queueCaptureEnrichment(params.teamId, lead);

    return {
        success: true,
        leadId: lead.id,
        matchedExisting,
        status,
        message: matchedExisting ? "LinkedIn capture synced to existing lead" : "LinkedIn capture created new lead",
        enrichmentQueued
    };
}

// Sequences a lead can be added to from the extension: switched on (ACTIVE) and made only of
// steps the sequence engine runs. Draft sequences stay out, so the extension never switches one on.
export async function listSequencesForExtension(teamId: string) {
    const sequences = await prisma.campaignSequence.findMany({
        where: { teamId, status: "ACTIVE" },
        select: {
            id: true,
            name: true,
            steps: { where: { status: "ACTIVE" }, select: { stepType: true, whatsappTemplateName: true } },
        },
        orderBy: { updatedAt: "desc" },
        take: 100,
    });
    return sequences
        .filter((sequence) => nurtureCanRunSteps(sequence.steps))
        .map((sequence) => ({ id: sequence.id, name: sequence.name, steps: sequence.steps.length }));
}

type PendingSequence = { sequenceId: string; chosenBy: string; chosenAt: string };

function enrichedObject(value: unknown): Record<string, any> {
    return value && typeof value === "object" && !Array.isArray(value) ? { ...(value as Record<string, any>) } : {};
}

// Adds a lead the extension saved to a sequence. A lead with no email yet waits: the choice is
// kept in enrichedData.pendingSequence and enrichment enrols it once an email is found.
export async function chooseSequenceForLead(params: { teamId: string; userId: string; leadId: string; sequenceId: string }) {
    const lead = await prisma.lead.findFirst({
        where: { id: params.leadId, teamId: params.teamId },
        select: { id: true, email: true, enrichedData: true },
    });
    if (!lead) throw new Error("Lead not found");
    const available = await listSequencesForExtension(params.teamId);
    const sequence = available.find((item) => item.id === params.sequenceId);
    if (!sequence) throw new Error("Sequence not available");

    const enrichedData = enrichedObject(lead.enrichedData);
    let status: "ENROLLED" | "WAITING_FOR_EMAIL";
    if (lead.email) {
        await new CmfSequenceProvider().enroll({ id: lead.id, teamId: params.teamId }, sequence.id);
        delete enrichedData["pendingSequence"];
        status = "ENROLLED";
    } else {
        const pending: PendingSequence = { sequenceId: sequence.id, chosenBy: params.userId, chosenAt: new Date().toISOString() };
        enrichedData["pendingSequence"] = pending;
        status = "WAITING_FOR_EMAIL";
    }
    await prisma.lead.update({ where: { id: lead.id }, data: { enrichedData } });
    await prisma.leadActivity.create({
        data: {
            leadId: lead.id,
            channel: "EMAIL",
            type: status === "ENROLLED" ? "SEQUENCE_ENROLLED" : "SEQUENCE_CHOSEN",
            title: status === "ENROLLED" ? `Added to sequence "${sequence.name}"` : `Will join sequence "${sequence.name}" once an email is found`,
            metadata: { sequenceId: sequence.id, source: "chrome_extension" },
            createdBy: params.userId,
        },
    });
    return {
        success: true as const,
        status,
        sequence: { id: sequence.id, name: sequence.name },
        message: status === "ENROLLED"
            ? `Added to "${sequence.name}".`
            : `No email yet. The lead joins "${sequence.name}" once it has one.`,
    };
}

// Called after a lead gets an email: enrols it in the sequence chosen in the extension, if the
// sequence is still switched on, and clears the choice either way. Returns whether it enrolled.
export async function enrollPendingSequence(leadId: string): Promise<boolean> {
    const lead = await prisma.lead.findUnique({ where: { id: leadId }, select: { id: true, teamId: true, email: true, enrichedData: true } });
    const enrichedData = enrichedObject(lead?.enrichedData);
    const pending = enrichedData["pendingSequence"] as PendingSequence | undefined;
    if (!lead?.teamId || !lead.email || !pending?.sequenceId) return false;

    const sequence = (await listSequencesForExtension(lead.teamId)).find((item) => item.id === pending.sequenceId);
    if (sequence) await new CmfSequenceProvider().enroll({ id: lead.id, teamId: lead.teamId }, sequence.id);
    delete enrichedData["pendingSequence"];
    await prisma.lead.update({ where: { id: lead.id }, data: { enrichedData } });
    await prisma.leadActivity.create({
        data: {
            leadId: lead.id,
            channel: "EMAIL",
            type: sequence ? "SEQUENCE_ENROLLED" : "SEQUENCE_SKIPPED",
            title: sequence
                ? `Added to sequence "${sequence.name}" after an email was found`
                : "The sequence chosen in the extension is no longer switched on, so the lead wasn't added",
            metadata: { sequenceId: pending.sequenceId, source: "chrome_extension" },
            createdBy: pending.chosenBy,
        },
    });
    return Boolean(sequence);
}

// A waiting lead can get its email from anywhere - enrichment, a CSV row, a manual edit in
// either app - so the worker also checks every few minutes for waiting leads that now have one.
export async function enrollWaitingSequences(limit = 50): Promise<number> {
    const rows = await prisma.$queryRaw<{ id: string }[]>`
        SELECT id FROM "Lead"
        WHERE email IS NOT NULL AND email <> '' AND "enrichedData" ? 'pendingSequence'
        ORDER BY "updatedAt" ASC
        LIMIT ${limit}`;
    let enrolled = 0;
    for (const row of rows) {
        try {
            if (await enrollPendingSequence(row.id)) enrolled++;
        } catch (error) {
            logger.warn("[extension sequences] couldn't enrol a waiting lead", { leadId: row.id, error: error instanceof Error ? error.message : error });
        }
    }
    return enrolled;
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
