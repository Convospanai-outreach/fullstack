import crypto from "crypto";
import { google } from "googleapis";
import { prisma } from "@/lib/db";
import { encryptSecret, decryptSecret } from "@/lib/mailboxCrypto";
import { createOpaqueToken, isSuppressed, logEmailActivity, prepareTrackedHtml } from "@/lib/emailTracking";
import { audit } from "@/lib/governance/audit";

const GMAIL_SCOPES = [
    "https://www.googleapis.com/auth/gmail.send",
    "https://www.googleapis.com/auth/gmail.readonly",
];

function getOAuthClient() {
    const clientId = process.env["GOOGLE_WORKSPACE_CLIENT_ID"] || process.env["GOOGLE_CLIENT_ID"];
    const clientSecret = process.env["GOOGLE_WORKSPACE_CLIENT_SECRET"] || process.env["GOOGLE_CLIENT_SECRET"];
    const redirectUri =
        process.env["GMAIL_OAUTH_REDIRECT_URI"] ||
        `${(process.env["NEXT_PUBLIC_API_URL"] || process.env["API_URL"] || "http://localhost:3001").replace(/\/$/, "")}/admin/mailboxes/callback`;

    if (!clientId || !clientSecret) {
        throw new Error("Google Workspace OAuth client is not configured.");
    }

    return new google.auth.OAuth2(clientId, clientSecret, redirectUri);
}

function stateSecret() {
    return process.env["NEXTAUTH_SECRET"] || process.env["AUTH_SECRET"] || "local-dev-state-secret";
}

function signState(payload: Record<string, string>) {
    const body = Buffer.from(JSON.stringify(payload)).toString("base64url");
    const sig = crypto.createHmac("sha256", stateSecret()).update(body).digest("base64url");
    return `${body}.${sig}`;
}

function verifyState(state: string): Record<string, string> {
    const [body, sig] = state.split(".");
    if (!body || !sig) throw new Error("Invalid OAuth state.");
    const expected = crypto.createHmac("sha256", stateSecret()).update(body).digest("base64url");
    if (!crypto.timingSafeEqual(Buffer.from(sig), Buffer.from(expected))) {
        throw new Error("Invalid OAuth state signature.");
    }
    return JSON.parse(Buffer.from(body, "base64url").toString("utf8"));
}

function base64Url(input: string | Buffer) {
    return Buffer.from(input).toString("base64").replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}

function encodeHeader(value: string) {
    return value.replace(/[\r\n]/g, " ").trim();
}

function htmlToText(html: string) {
    return html
        .replace(/<style[\s\S]*?<\/style>/gi, "")
        .replace(/<script[\s\S]*?<\/script>/gi, "")
        .replace(/<[^>]+>/g, " ")
        .replace(/\s+/g, " ")
        .trim();
}

function buildRawMessage(input: {
    from: string;
    to: string;
    subject: string;
    html: string;
    messageId: string;
    listUnsubscribeUrl: string;
    replyTo?: string;
}) {
    const boundary = `convo_${crypto.randomBytes(12).toString("hex")}`;
    const headers = [
        `From: ${input.from}`,
        `To: ${encodeHeader(input.to)}`,
        `Subject: ${encodeHeader(input.subject)}`,
        `Message-ID: <${input.messageId}>`,
        "MIME-Version: 1.0",
        `Reply-To: ${encodeHeader(input.replyTo || input.from)}`,
        `List-Unsubscribe: <${input.listUnsubscribeUrl}>`,
        `List-Unsubscribe-Post: List-Unsubscribe=One-Click`,
        `Content-Type: multipart/alternative; boundary="${boundary}"`,
    ];
    const text = htmlToText(input.html);
    const body = [
        `--${boundary}`,
        "Content-Type: text/plain; charset=UTF-8",
        "Content-Transfer-Encoding: 7bit",
        "",
        text,
        `--${boundary}`,
        "Content-Type: text/html; charset=UTF-8",
        "Content-Transfer-Encoding: 7bit",
        "",
        input.html,
        `--${boundary}--`,
    ];
    return base64Url(`${headers.join("\r\n")}\r\n\r\n${body.join("\r\n")}`);
}

function publicApiBase() {
    return (process.env["NEXT_PUBLIC_API_URL"] || process.env["API_URL"] || "http://localhost:3001").replace(/\/$/, "");
}

async function getAuthorizedGmail(mailbox: any) {
    const oauth = getOAuthClient();
    oauth.setCredentials({
        access_token: decryptSecret(mailbox.accessTokenEncrypted || null) || undefined,
        refresh_token: decryptSecret(mailbox.refreshTokenEncrypted || null) || undefined,
        expiry_date: mailbox.expiresAt ? mailbox.expiresAt.getTime() : undefined,
    });
    return google.gmail({ version: "v1", auth: oauth });
}

export const GmailMailboxService = {
    scopes: GMAIL_SCOPES,

    createConnectUrl(teamId: string, actorId: string) {
        const oauth = getOAuthClient();
        return oauth.generateAuthUrl({
            access_type: "offline",
            prompt: "consent",
            scope: GMAIL_SCOPES,
            state: signState({ teamId, actorId, nonce: crypto.randomUUID() }),
        });
    },

    async handleCallback(code: string, state: string) {
        const parsed = verifyState(state);
        const oauth = getOAuthClient();
        const { tokens } = await oauth.getToken(code);
        oauth.setCredentials(tokens);
        const oauth2 = google.oauth2({ version: "v2", auth: oauth });
        const profile = await oauth2.userinfo.get();
        const emailAddress = profile.data.email;
        if (!emailAddress) {
            throw new Error("Google account did not return an email address.");
        }

        const mailbox = await (prisma as any).connectedMailbox.upsert({
            where: { teamId_emailAddress: { teamId: parsed.teamId, emailAddress } },
            update: {
                accessTokenEncrypted: encryptSecret(tokens.access_token || null),
                refreshTokenEncrypted: tokens.refresh_token ? encryptSecret(tokens.refresh_token) : undefined,
                expiresAt: tokens.expiry_date ? new Date(tokens.expiry_date) : null,
                scopes: GMAIL_SCOPES,
                status: "ACTIVE",
                lastError: null,
            },
            create: {
                teamId: parsed.teamId,
                emailAddress,
                accessTokenEncrypted: encryptSecret(tokens.access_token || null),
                refreshTokenEncrypted: encryptSecret(tokens.refresh_token || null),
                expiresAt: tokens.expiry_date ? new Date(tokens.expiry_date) : null,
                scopes: GMAIL_SCOPES,
            },
        });

        await this.startWatch(mailbox.id, parsed.actorId);
        await audit({
            actorId: parsed.actorId,
            orgId: parsed.teamId,
            action: "MAILBOX_CONNECTED",
            entity: "ConnectedMailbox",
            entityId: mailbox.id,
            metadata: { provider: "GOOGLE", emailAddress },
        });
        return mailbox;
    },

    async getActiveMailbox(teamId: string) {
        return (prisma as any).connectedMailbox.findFirst({
            where: { teamId, provider: "GOOGLE", status: "ACTIVE" },
            orderBy: { updatedAt: "desc" },
        });
    },

    async startWatch(mailboxId: string, actorId?: string | null) {
        const topicName = process.env["GMAIL_PUBSUB_TOPIC"];
        if (!topicName) return null;
        const mailbox = await (prisma as any).connectedMailbox.findUnique({ where: { id: mailboxId } });
        if (!mailbox) throw new Error("Mailbox not found.");
        const gmail = await getAuthorizedGmail(mailbox);
        const result = await gmail.users.watch({
            userId: "me",
            requestBody: {
                topicName,
                labelIds: ["INBOX"],
                labelFilterBehavior: "include",
            },
        });
        const updated = await (prisma as any).connectedMailbox.update({
            where: { id: mailbox.id },
            data: {
                gmailHistoryId: result.data.historyId || mailbox.gmailHistoryId,
                watchExpiration: result.data.expiration ? new Date(Number(result.data.expiration)) : null,
                lastError: null,
            },
        });
        await audit({
            actorId: actorId || "system",
            orgId: mailbox.teamId,
            action: "GMAIL_WATCH_RENEWED",
            entity: "ConnectedMailbox",
            entityId: mailbox.id,
            metadata: { expiration: updated.watchExpiration?.toISOString() || null },
        });
        return updated;
    },

    async sendCampaignEmail(input: {
        teamId: string;
        to: string;
        subject: string;
        html: string;
        leadId?: string;
        campaignId?: string;
        fromName?: string;
        fromEmail?: string;
    }) {
        if (await isSuppressed(input.teamId, input.to)) {
            return { success: false, error: "Recipient is suppressed for this team." };
        }

        const mailbox = await this.getActiveMailbox(input.teamId);
        if (!mailbox) return null;

        let emailRecord: any = null;
        if (input.leadId && input.campaignId) {
            emailRecord = await (prisma as any).email.create({
                data: {
                    leadId: input.leadId,
                    campaignId: input.campaignId,
                    subject: input.subject,
                    body: input.html,
                    status: "queued",
                    trackingToken: createOpaqueToken(),
                },
            });
        }

        const trackingToken = emailRecord?.trackingToken || createOpaqueToken();
        const trackedHtml = await prepareTrackedHtml({
            html: input.html,
            teamId: input.teamId,
            campaignId: input.campaignId || null,
            leadId: input.leadId || null,
            emailId: emailRecord?.id || null,
            trackingToken,
        });
        const unsubscribeUrl = `${publicApiBase()}/t/unsubscribe?token=${encodeURIComponent(trackingToken)}`;
        const messageId = `${crypto.randomUUID()}@convospan.local`;
        const fromName = input.fromName || mailbox.emailAddress;
        const fromEmail = input.fromEmail || mailbox.emailAddress;
        const gmail = await getAuthorizedGmail(mailbox);
        const raw = buildRawMessage({
            from: `"${encodeHeader(fromName)}" <${encodeHeader(fromEmail)}>`,
            to: input.to,
            subject: input.subject,
            html: trackedHtml,
            messageId,
            listUnsubscribeUrl: unsubscribeUrl,
            replyTo: mailbox.emailAddress,
        });

        try {
            const sent = await gmail.users.messages.send({
                userId: "me",
                requestBody: { raw },
            });
            if (emailRecord) {
                await (prisma as any).email.update({
                    where: { id: emailRecord.id },
                    data: {
                        body: trackedHtml,
                        status: "sent",
                        providerId: sent.data.id || messageId,
                        gmailThreadId: sent.data.threadId || null,
                        sentAt: new Date(),
                    },
                });
            }
            await logEmailActivity({
                teamId: input.teamId,
                emailId: emailRecord?.id || null,
                campaignId: input.campaignId || null,
                leadId: input.leadId || null,
                messageId: sent.data.id || messageId,
                eventType: "SENT",
                metadata: { provider: "GOOGLE", threadId: sent.data.threadId || null },
            });
            return { success: true, providerId: sent.data.id || messageId, threadId: sent.data.threadId || undefined };
        } catch (error: any) {
            if (emailRecord) {
                await (prisma as any).email.update({
                    where: { id: emailRecord.id },
                    data: { status: "failed" },
                });
            }
            await logEmailActivity({
                teamId: input.teamId,
                emailId: emailRecord?.id || null,
                campaignId: input.campaignId || null,
                leadId: input.leadId || null,
                eventType: "FAILED",
                metadata: { provider: "GOOGLE", error: error?.message || String(error) },
            });
            return { success: false, error: error?.message || "Gmail send failed." };
        }
    },

    async getGmail(mailbox: any) {
        return getAuthorizedGmail(mailbox);
    },
};

