import crypto from "crypto";
import { prisma } from "@/lib/db";

const TRACKING_GIF = Buffer.from(
    "R0lGODlhAQABAPAAAP///wAAACH5BAAAAAAALAAAAAABAAEAAAICRAEAOw==",
    "base64"
);

function baseUrl() {
    return (
        process.env["NEXT_PUBLIC_API_URL"] ||
        process.env["API_URL"] ||
        process.env["NEXTAUTH_URL"] ||
        "http://localhost:3001"
    ).replace(/\/$/, "");
}

export function createOpaqueToken(): string {
    return crypto.randomBytes(24).toString("base64url");
}

export function transparentGifResponse(): Response {
    return new Response(TRACKING_GIF, {
        status: 200,
        headers: {
            "Content-Type": "image/gif",
            "Content-Length": String(TRACKING_GIF.length),
            "Cache-Control": "no-store, no-cache, must-revalidate, proxy-revalidate",
            Pragma: "no-cache",
            Expires: "0",
        },
    });
}

function isSafeHttpUrl(url: string): boolean {
    try {
        const parsed = new URL(url);
        return parsed.protocol === "http:" || parsed.protocol === "https:";
    } catch {
        return false;
    }
}

export async function addSuppression(teamId: string, email: string, reason: string, source: string, metadata?: Record<string, any>) {
    return (prisma as any).suppressionEntry.upsert({
        where: { teamId_email: { teamId, email: email.toLowerCase() } },
        update: { reason, source, metadata: metadata || undefined },
        create: { teamId, email: email.toLowerCase(), reason, source, metadata: metadata || undefined },
    });
}

export async function isSuppressed(teamId: string, email: string): Promise<boolean> {
    const found = await (prisma as any).suppressionEntry.findUnique({
        where: { teamId_email: { teamId, email: email.toLowerCase() } },
        select: { id: true },
    });
    return Boolean(found);
}

export async function logEmailActivity(input: {
    teamId: string;
    emailId?: string | null;
    campaignId?: string | null;
    leadId?: string | null;
    messageId?: string | null;
    eventType: string;
    metadata?: Record<string, any> | null;
}) {
    return (prisma as any).emailActivityLog.create({
        data: {
            teamId: input.teamId,
            emailId: input.emailId || null,
            campaignId: input.campaignId || null,
            leadId: input.leadId || null,
            messageId: input.messageId || null,
            eventType: input.eventType,
            metadata: input.metadata || undefined,
        },
    });
}

export async function prepareTrackedHtml(input: {
    html: string;
    teamId: string;
    campaignId?: string | null;
    leadId?: string | null;
    emailId?: string | null;
    trackingToken: string;
}) {
    let html = input.html;
    const linkRegex = /href=(["'])(https?:\/\/[^"']+)\1/gi;
    const replacements: Array<{ original: string; tracked: string }> = [];
    let match: RegExpExecArray | null;

    while ((match = linkRegex.exec(input.html)) !== null) {
        const originalUrl = match[2];
        if (!isSafeHttpUrl(originalUrl) || originalUrl.includes("/t/")) continue;
        const token = createOpaqueToken();
        await (prisma as any).emailTrackedLink.create({
            data: {
                teamId: input.teamId,
                emailId: input.emailId || null,
                campaignId: input.campaignId || null,
                leadId: input.leadId || null,
                token,
                originalUrl,
            },
        });
        replacements.push({
            original: match[0],
            tracked: `href=${match[1]}${baseUrl()}/t/click?token=${encodeURIComponent(token)}${match[1]}`,
        });
    }

    for (const replacement of replacements) {
        html = html.replace(replacement.original, replacement.tracked);
    }

    const pixel = `<img src="${baseUrl()}/t/open?token=${encodeURIComponent(input.trackingToken)}" width="1" height="1" alt="" style="display:none;border:0;width:1px;height:1px;" />`;
    return html.includes("</body>") ? html.replace(/<\/body>/i, `${pixel}</body>`) : `${html}${pixel}`;
}

export async function recordOpen(token: string, metadata?: Record<string, any>) {
    const email = await (prisma as any).email.findUnique({ where: { trackingToken: token } });
    if (!email) return null;
    const campaign = await prisma.campaign.findUnique({ where: { id: email.campaignId }, select: { teamId: true } });
    if (!campaign?.teamId) return email;
    const firstOpen = !email.openedAt;
    await (prisma as any).email.update({
        where: { id: email.id },
        data: { openedAt: email.openedAt || new Date() },
    });
    await logEmailActivity({
        teamId: campaign.teamId,
        emailId: email.id,
        campaignId: email.campaignId,
        leadId: email.leadId,
        messageId: email.providerId,
        eventType: "OPENED",
        metadata: { ...metadata, firstOpen },
    });
    if (firstOpen) {
        await prisma.campaignVariant.updateMany({
            where: { campaignId: email.campaignId },
            data: { openCount: { increment: 1 } },
        });
    }
    return email;
}

export async function recordClick(token: string, metadata?: Record<string, any>) {
    const link = await (prisma as any).emailTrackedLink.findUnique({ where: { token } });
    if (!link || !isSafeHttpUrl(link.originalUrl)) return null;
    await (prisma as any).emailTrackedLink.update({
        where: { token },
        data: { clickCount: { increment: 1 }, lastClickedAt: new Date() },
    });
    if (link.emailId) {
        await (prisma as any).email.update({
            where: { id: link.emailId },
            data: { clickedAt: new Date() },
        });
    }
    if (link.leadId) {
        await prisma.lead.updateMany({
            where: { id: link.leadId },
            data: { emailClicks: { increment: 1 } },
        });
    }
    await logEmailActivity({
        teamId: link.teamId,
        emailId: link.emailId,
        campaignId: link.campaignId,
        leadId: link.leadId,
        eventType: "CLICKED",
        metadata: { ...metadata, url: link.originalUrl },
    });
    return link;
}

