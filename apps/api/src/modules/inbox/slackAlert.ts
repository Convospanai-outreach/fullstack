import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";
import { decryptCredential, encryptCredential, type EncryptedCredential } from "@/lib/security/credentialVault";

// Optional per-user Slack push for hot replies. The user pastes a Slack incoming-webhook
// URL; it's stored encrypted in NotificationSettings.slackWebhook and never read back to
// the client. Only hooks.slack.com URLs are accepted and redirects are refused, so the
// server only ever posts to Slack.

export const SLACK_WEBHOOK_PATTERN = /^https:\/\/hooks\.slack\.com\/services\/[A-Za-z0-9_\-/]+$/;
const SLACK_TIMEOUT_MS = 5000;

// Slack treats &, < and > as control characters (<url|text> links, <!channel> mentions),
// so lead-supplied text is escaped before it goes into a message.
export function slackEscape(value: string) {
    return value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

export async function postToSlack(webhookUrl: string, text: string) {
    if (!SLACK_WEBHOOK_PATTERN.test(webhookUrl)) return false;
    const res = await fetch(webhookUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text }),
        redirect: "error",
        signal: AbortSignal.timeout(SLACK_TIMEOUT_MS),
    });
    return res.ok;
}

export async function hasSlackWebhook(userId: string) {
    const row = await prisma.notificationSettings.findUnique({ where: { userId }, select: { slackWebhook: true } });
    return row?.slackWebhook != null;
}

/** Saves (after a test post succeeds) or clears the user's webhook. Returns false if Slack rejected it. */
export async function setSlackWebhook(userId: string, url: string | null) {
    if (url && !(await postToSlack(url, "CraftMyFunnel reply alerts are connected to this channel."))) return false;

    // getSettings creates the NotificationSettings row if the user doesn't have one yet.
    const { settingsService } = await import("@/modules/settings/service/settingsService");
    await settingsService.getSettings(userId);
    await prisma.notificationSettings.update({
        where: { userId },
        data: { slackWebhook: url ? ((await encryptCredential(url)) as unknown as Prisma.InputJsonValue) : Prisma.DbNull },
    });
    return true;
}

/** Posts `text` to each user's Slack webhook, if they set one. Failures are logged, never thrown. */
export async function sendSlackAlerts(userIds: string[], text: string) {
    const rows = await prisma.notificationSettings.findMany({
        where: { userId: { in: userIds }, slackWebhook: { not: Prisma.DbNull } },
        select: { userId: true, slackWebhook: true },
    });
    for (const row of rows) {
        try {
            const url = await decryptCredential(row.slackWebhook as unknown as EncryptedCredential);
            if (url && !(await postToSlack(url, text))) console.warn(`[InboxAlerts] Slack rejected the alert for user ${row.userId}`);
        } catch (error) {
            console.error(`[InboxAlerts] Slack alert failed for user ${row.userId}:`, error instanceof Error ? error.message : error);
        }
    }
}
