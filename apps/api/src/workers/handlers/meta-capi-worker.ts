import { prisma } from "@/lib/db";
import { logger } from "@/lib/logger";
import { JobPayload, NonRetryableJobError } from "@/lib/queue";
import { decryptCredential, type EncryptedCredential } from "@/lib/security/credentialVault";
import { buildLeadEvent, isEventTimeSendable } from "@/modules/landing-agent/metaCapi";
import { sendMetaLeadEvents } from "@/modules/landing-agent/metaCapiSender";

// Sends one website Lead to Meta's Conversions API for a landing-page lead (queued by the lead submit's outbox
// event, so a Meta outage never delays or fails the lead). Team-scoped: the token and the lead both come from
// the lead's team. Retryable Meta failures throw, so the job queue retries them with backoff.

function text(value: unknown): string | undefined {
    return typeof value === "string" && value.trim() ? value : undefined;
}

export async function handleMetaCapiLead(payload: JobPayload) {
    const teamId = text(payload.teamId);
    const landingLeadId = text(payload.landingLeadId);
    const pixelId = text(payload.pixelId);
    const eventId = text(payload.eventId);
    const eventSourceUrl = text(payload.eventSourceUrl);
    const eventTime = typeof payload.eventTime === "number" && Number.isFinite(payload.eventTime) ? payload.eventTime : undefined;
    if (!teamId || !landingLeadId || !pixelId || !eventId || !eventSourceUrl || eventTime === undefined) {
        throw new NonRetryableJobError("meta_capi_lead payload is incomplete");
    }

    if (!isEventTimeSendable(eventTime, Math.floor(Date.now() / 1000))) {
        return { sent: false, reason: "event_too_old" };
    }

    const team = await prisma.team.findUnique({ where: { id: teamId }, select: { metaCapiTokenEnc: true } });
    const accessToken = await decryptCredential((team?.metaCapiTokenEnc as EncryptedCredential | null) ?? null);
    if (!accessToken) {
        return { sent: false, reason: "no_token" };
    }

    const lead = await prisma.landingLead.findFirst({
        where: { id: landingLeadId, teamId },
        select: { name: true, email: true, phone: true, ipAddress: true, userAgent: true },
    });
    if (!lead) {
        return { sent: false, reason: "lead_not_found" };
    }

    const result = await sendMetaLeadEvents({
        pixelId,
        accessToken,
        payload: buildLeadEvent({
            eventId,
            eventTime,
            eventSourceUrl,
            email: lead.email ?? undefined,
            name: lead.name ?? undefined,
            phone: lead.phone ?? undefined,
            clientIp: lead.ipAddress ?? undefined,
            clientUserAgent: lead.userAgent ?? undefined,
            fbc: text(payload.fbc),
            fbp: text(payload.fbp),
            testEventCode: text(payload.testEventCode),
        }),
    });

    if (result.ok) {
        logger.info(`[MetaCapi] Lead ${landingLeadId} sent (event ${eventId})`);
        return { sent: true };
    }
    if (!result.retryable) {
        throw new NonRetryableJobError(result.reason);
    }
    throw new Error(result.reason);
}
