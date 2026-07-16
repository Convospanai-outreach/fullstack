import { prisma } from "@/lib/db";
import { JobPayload } from "@/lib/queue";
import {
    acquireGmailMailboxLease,
    syncGoogleMailbox,
} from "@/modules/email-campaigner/service/googleMailboxService";

/**
 * Worker handler for INBOX_SYNC jobs.
 * Performs asynchronous mailbox sync utilizing the existing Gmail sync service layer.
 */
export async function handleGmailHistorySync(payload: JobPayload) {
    if (!payload || typeof payload !== "object" || Array.isArray(payload)) {
        throw new Error("Invalid job payload: must be an object.");
    }

    const teamId = payload.teamId;
    const mailboxId = payload.mailboxId;
    const notificationHistoryId = payload.notificationHistoryId;
    const pubsubMessageId = payload.pubsubMessageId;

    if (typeof teamId !== "string" || teamId.trim() === "") {
        throw new Error("Invalid job payload: teamId must be a non-empty string.");
    }
    if (typeof mailboxId !== "string" || mailboxId.trim() === "") {
        throw new Error("Invalid job payload: mailboxId must be a non-empty string.");
    }
    if (typeof notificationHistoryId !== "string" || notificationHistoryId.trim() === "") {
        throw new Error("Invalid job payload: notificationHistoryId must be a non-empty string.");
    }
    if (pubsubMessageId !== undefined && (typeof pubsubMessageId !== "string" || pubsubMessageId.trim() === "")) {
        throw new Error("Invalid job payload: pubsubMessageId when present must be a non-empty string.");
    }

    // Load mailbox by unique ID
    const mailbox = await prisma.connectedMailbox.findUnique({
        where: { id: mailboxId }
    });

    if (!mailbox) {
        throw new Error(`Mailbox not found: ${mailboxId}`);
    }

    // Verify team matches
    if (mailbox.teamId !== teamId) {
        throw new Error(`Mismatched team ID: mailbox belongs to team ${mailbox.teamId}, payload specified ${teamId}`);
    }

    // Verify provider is GOOGLE_WORKSPACE
    if (mailbox.provider !== "GOOGLE_WORKSPACE") {
        throw new Error(`Invalid mailbox provider: expected GOOGLE_WORKSPACE, found ${mailbox.provider}`);
    }

    const lease = await acquireGmailMailboxLease(mailbox);
    const syncResult = await syncGoogleMailbox(teamId, mailboxId, { lease });

    // Return non-secret metadata
    return {
        mailboxId,
        synced: syncResult.synced,
        replies: syncResult.replies,
        bounces: syncResult.bounces,
    };
}
