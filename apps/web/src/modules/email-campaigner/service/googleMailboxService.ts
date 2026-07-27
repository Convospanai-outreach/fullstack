import crypto from "crypto";
import { prisma } from "@/lib/db";

const GOOGLE_AUTH_URL = "https://accounts.google.com/o/oauth2/v2/auth";
const GOOGLE_TOKEN_URL = "https://oauth2.googleapis.com/token";
const GMAIL_MESSAGES_URL = "https://gmail.googleapis.com/gmail/v1/users/me/messages";
const GMAIL_PROFILE_URL = "https://gmail.googleapis.com/gmail/v1/users/me/profile";

const GOOGLE_MAIL_SCOPES = [
    "openid",
    "email",
    "profile",
    "https://www.googleapis.com/auth/gmail.send",
    "https://www.googleapis.com/auth/gmail.readonly",
];

type EncryptedSecret = {
    v: number;
    cipher: string;
    iv: string;
    tag: string;
};

type OAuthStatePayload = {
    teamId: string;
    userId: string;
    nextPath?: string;
    nonce: string;
    ts: number;
};

import { encryptCredential, decryptCredential, EncryptedCredential } from "@/lib/security/credentialVault";

export async function decryptMailboxSecret(secret?: EncryptedCredential | null): Promise<string | undefined> {
    return decryptCredential(secret);
}

async function encryptSecret(value: string): Promise<EncryptedCredential> {
    return encryptCredential(value);
}

function getGoogleConfig() {
    const clientId = process.env["GOOGLE_CLIENT_ID"];
    const clientSecret = process.env["GOOGLE_CLIENT_SECRET"];
    const redirectUri = process.env["GOOGLE_GMAIL_REDIRECT_URI"] || "https://api.craftmyfunnel.live/integrations/google/oauth/callback";
    if (!clientId || !clientSecret) {
        throw new Error("GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET must be configured.");
    }
    return { clientId, clientSecret, redirectUri };
}

export function sanitizeRelativePath(path?: string | null) {
    if (!path || !path.startsWith("/") || path.startsWith("//")) return "/setup?step=3";
    try {
        const parsed = new URL(path, "https://app.local");
        if (parsed.origin !== "https://app.local") return "/setup?step=3";
        return `${parsed.pathname}${parsed.search}${parsed.hash}`;
    } catch {
        return "/setup?step=3";
    }
}

function getStateSecret(): string | undefined {
    return process.env["NEXTAUTH_SECRET"] || process.env["ENCRYPTION_KEY"];
}

function signState(payload: OAuthStatePayload): string {
    const secret = getStateSecret();
    if (!secret) throw new Error("NEXTAUTH_SECRET or ENCRYPTION_KEY is required for Google OAuth state signing.");
    const body = Buffer.from(JSON.stringify(payload)).toString("base64url");
    const sig = crypto.createHmac("sha256", secret).update(body).digest("base64url");
    return `${body}.${sig}`;
}

function verifyState(state: string): OAuthStatePayload {
    const secret = getStateSecret();
    if (!secret) throw new Error("NEXTAUTH_SECRET or ENCRYPTION_KEY is required for Google OAuth state verification.");
    const [body, sig] = state.split(".");
    if (!body || !sig) throw new Error("Invalid OAuth state.");
    const expected = crypto.createHmac("sha256", secret).update(body).digest("base64url");
    const sigBuf = Buffer.from(sig);
    const expectedBuf = Buffer.from(expected);
    if (sigBuf.length !== expectedBuf.length || !crypto.timingSafeEqual(sigBuf, expectedBuf)) {
        throw new Error("Invalid OAuth state signature.");
    }
    const payload = JSON.parse(Buffer.from(body, "base64url").toString("utf8")) as OAuthStatePayload;
    if (!payload || typeof payload !== "object" || !payload.teamId || !payload.userId) {
        throw new Error("Invalid OAuth state structure.");
    }
    return payload;
}

export async function buildGoogleMailboxAuthUrl(input: { teamId: string; userId: string; nextPath?: string }): Promise<string> {
    const { clientId, redirectUri } = getGoogleConfig();
    const nonce = crypto.randomUUID();
    const ts = Date.now();
    const statePayload = {
        teamId: input.teamId,
        userId: input.userId,
        nextPath: sanitizeRelativePath(input.nextPath),
        nonce,
        ts,
    };
    const state = signState(statePayload);

    const params = new URLSearchParams({
        client_id: clientId,
        redirect_uri: redirectUri,
        response_type: "code",
        access_type: "offline",
        prompt: "consent",
        include_granted_scopes: "true",
        scope: GOOGLE_MAIL_SCOPES.join(" "),
        state,
    });
    return `${GOOGLE_AUTH_URL}?${params.toString()}`;
}

export async function connectGoogleMailbox(input: { code: string; state: string }) {
    const statePayload = verifyState(input.state);
    const { clientId, clientSecret, redirectUri } = getGoogleConfig();

    const response = await fetch(GOOGLE_TOKEN_URL, {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({
            code: input.code,
            client_id: clientId,
            client_secret: clientSecret,
            redirect_uri: redirectUri,
            grant_type: "authorization_code",
        }),
    });
    const token = await response.json() as any;
    if (!response.ok) {
        throw new Error(token?.error_description || token?.error || "Google token exchange failed.");
    }

    const profileRes = await fetch(GMAIL_PROFILE_URL, {
        headers: { Authorization: `Bearer ${token.access_token}` },
    });
    const profile = await profileRes.json() as any;
    if (!profileRes.ok || !profile.emailAddress) {
        throw new Error("Unable to fetch Gmail profile.");
    }

    const email = profile.emailAddress.toLowerCase();
    const encryptedAccessToken = await encryptSecret(token.access_token);
    const encryptedRefreshToken = token.refresh_token ? await encryptSecret(token.refresh_token) : undefined;
    const tokenExpiresAt = token.expires_in ? new Date(Date.now() + token.expires_in * 1000) : null;

    const existingMailbox = await prisma.connectedMailbox.findFirst({ where: { email } });
    if (existingMailbox && existingMailbox.teamId !== statePayload.teamId) {
        throw new Error("Mailbox is already connected to another team.");
    }

    const mailbox = existingMailbox
        ? await prisma.connectedMailbox.update({
              where: { id: existingMailbox.id },
              data: {
                  status: "CONNECTED",
                  encryptedAccessToken,
                  ...(encryptedRefreshToken ? { encryptedRefreshToken } : {}),
                  tokenExpiresAt,
              },
          })
        : await prisma.connectedMailbox.create({
              data: {
                  teamId: statePayload.teamId,
                  email,
                  status: "CONNECTED",
                  encryptedAccessToken,
                  ...(encryptedRefreshToken ? { encryptedRefreshToken } : {}),
                  tokenExpiresAt,
              },
          });

    return { mailbox, nextPath: statePayload.nextPath };
}

async function refreshAccessToken(mailbox: any) {
    const refreshToken = await decryptMailboxSecret(mailbox.encryptedRefreshToken);
    if (!refreshToken) throw new Error("Mailbox needs reconnect before send.");

    const { clientId, clientSecret } = getGoogleConfig();
    const response = await fetch(GOOGLE_TOKEN_URL, {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({
            client_id: clientId,
            client_secret: clientSecret,
            refresh_token: refreshToken,
            grant_type: "refresh_token",
        }),
    });
    const data = await response.json() as any;
    if (!response.ok) {
        await prisma.connectedMailbox.update({
            where: { id: mailbox.id },
            data: { status: "NEEDS_RECONNECT" },
        }).catch(() => undefined);
        throw new Error(data?.error_description || data?.error || "Google token refresh failed.");
    }

    const encryptedAccessToken = await encryptSecret(data.access_token);
    const tokenExpiresAt = data.expires_in ? new Date(Date.now() + data.expires_in * 1000) : null;
    await prisma.connectedMailbox.update({
        where: { id: mailbox.id },
        data: { encryptedAccessToken, tokenExpiresAt, status: "CONNECTED" },
    });
    return data.access_token as string;
}

async function getMailboxAccessToken(mailbox: any) {
    if (mailbox.encryptedAccessToken && mailbox.tokenExpiresAt && mailbox.tokenExpiresAt > new Date(Date.now() + 60_000)) {
        return decryptMailboxSecret(mailbox.encryptedAccessToken);
    }
    return refreshAccessToken(mailbox);
}

function encodeMimeHeader(value: string) {
    return value.replace(/\r?\n/g, " ").trim();
}

function rejectHeaderInjection(value: string, field: string) {
    if (/[\r\n]/.test(value)) {
        throw new Error(`${field} cannot contain line breaks.`);
    }
}

function normalizeEmailAddress(value: string) {
    rejectHeaderInjection(value, "Email address");
    const match = value.trim().match(/^(?:[^<]*<)?([^<>\s@]+@[^<>\s@]+\.[^<>\s@]+)>?$/);
    if (!match?.[1]) {
        throw new Error("Invalid email address.");
    }
    return match[1].toLowerCase();
}

function base64Url(input: string) {
    return Buffer.from(input)
        .toString("base64")
        .replace(/\+/g, "-")
        .replace(/\//g, "_")
        .replace(/=+$/g, "");
}

export async function markMailboxSend(teamId: string, mailboxId: string) {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const mailbox = await prisma.connectedMailbox.findFirst({ where: { id: mailboxId, teamId } });
    if (!mailbox) return null;
    const sentTodayDate = mailbox.sentTodayDate ? new Date(mailbox.sentTodayDate) : null;
    const shouldReset = !sentTodayDate || sentTodayDate < today;
    return prisma.connectedMailbox.update({
        where: { id: mailboxId },
        data: {
            sentTodayDate: today,
            sentToday: shouldReset ? 1 : { increment: 1 },
            lastSentAt: new Date(),
        },
    });
}

export async function sendViaGmailMailbox(input: {
    teamId: string;
    mailboxId: string;
    to: string;
    subject: string;
    html: string;
    replyTo?: string;
    trackingId?: string;
}) {
    const mailbox = await prisma.connectedMailbox.findFirst({
        where: { id: input.mailboxId, teamId: input.teamId, status: "CONNECTED" },
    });
    if (!mailbox) return { success: false, error: "Connected mailbox not found." };

    const accessToken = await getMailboxAccessToken(mailbox);
    if (!accessToken) return { success: false, error: "Mailbox needs reconnect." };

    const fromName = mailbox.displayName || mailbox.email;
    const to = normalizeEmailAddress(input.to);
    const replyTo = input.replyTo ? normalizeEmailAddress(input.replyTo) : undefined;
    const domain = mailbox.email.split("@")[1] || "craftmyfunnel.live";
    const rfcMessageId = `<${crypto.randomUUID()}@${domain}>`;

    const baseUrl = process.env["PUBLIC_BASE_URL"] || "https://api.craftmyfunnel.live";
    const trackingId = input.trackingId || crypto.randomUUID();
    const unsubscribeUrl = `${baseUrl}/api/proxy/email/unsubscribe/${trackingId}`;

    const headers = [
        `From: "${encodeMimeHeader(fromName)}" <${mailbox.email}>`,
        `To: ${to}`,
        `Subject: ${encodeMimeHeader(input.subject)}`,
        `Message-ID: ${rfcMessageId}`,
        `List-Unsubscribe: <${unsubscribeUrl}>`,
        `List-Unsubscribe-Post: List-Unsubscribe=One-Click`,
        "MIME-Version: 1.0",
        "Content-Type: text/html; charset=UTF-8",
        ...(replyTo ? [`Reply-To: ${replyTo}`] : []),
    ];
    const raw = base64Url(`${headers.join("\r\n")}\r\n\r\n${input.html}`);

    const response = await fetch(`${GMAIL_MESSAGES_URL}/send`, {
        method: "POST",
        headers: {
            Authorization: `Bearer ${accessToken}`,
            "Content-Type": "application/json",
        },
        body: JSON.stringify({ raw }),
    });
    const data = await response.json() as any;
    if (!response.ok) {
        return { success: false, error: data?.error?.message || "Gmail send failed." };
    }

    let actualWireMessageId = rfcMessageId;
    if (data.id) {
        try {
            const metaRes = await fetch(`${GMAIL_MESSAGES_URL}/${data.id}?format=metadata&metadataHeaders=Message-ID`, {
                headers: { Authorization: `Bearer ${accessToken}` },
            });
            if (metaRes.ok) {
                const metaData = await metaRes.json() as any;
                const wireHeader = metaData?.payload?.headers?.find((h: any) => h.name?.toLowerCase() === "message-id")?.value;
                if (wireHeader) {
                    actualWireMessageId = wireHeader.trim();
                }
            } else {
                console.warn(`[googleMailboxService] Post-send Message-ID fetch returned non-200 status (${metaRes.status}). Falling back to rfcMessageId ${rfcMessageId}`);
            }
        } catch (fetchErr: any) {
            console.warn(`[googleMailboxService] Post-send Message-ID fetch error (${fetchErr?.message}). Falling back to rfcMessageId ${rfcMessageId}`);
        }
    }

    await markMailboxSend(input.teamId, mailbox.id);
    return {
        success: true,
        messageId: actualWireMessageId,
        rfcMessageId,
        gmailId: data.id as string | undefined,
        threadId: data.threadId as string | undefined,
        mailboxId: mailbox.id,
    };
}

export async function syncGmailInboundReplies(mailboxId: string, notificationHistoryId?: string) {
    const mailbox = await prisma.connectedMailbox.findUnique({
        where: { id: mailboxId },
    });

    if (!mailbox || mailbox.status !== "CONNECTED") {
        return { synced: 0, replies: 0, bounces: 0 };
    }

    const accessToken = await getMailboxAccessToken(mailbox);
    if (!accessToken) return { synced: 0, replies: 0, bounces: 0 };

    const startHistoryId = mailbox.historyId || notificationHistoryId;
    let messageIds: string[] = [];
    let latestHistoryId = notificationHistoryId || mailbox.historyId;

    if (startHistoryId) {
        let pageToken: string | undefined;
        let isStaleHistory = false;

        do {
            try {
                const params = new URLSearchParams({
                    startHistoryId,
                    historyTypes: "messageAdded",
                    labelId: "INBOX",
                });
                if (pageToken) params.set("pageToken", pageToken);

                const historyUrl = `https://gmail.googleapis.com/gmail/v1/users/me/history?${params.toString()}`;
                const historyRes = await fetch(historyUrl, {
                    headers: { Authorization: `Bearer ${accessToken}` },
                });

                if (historyRes.status === 404 || historyRes.status === 400) {
                    isStaleHistory = true;
                    console.warn(`[syncGmailInboundReplies] Stale historyId ${startHistoryId} for mailbox ${mailbox.id} (HTTP ${historyRes.status}). Triggering profile history resync fallback.`);
                    break;
                }

                if (historyRes.ok) {
                    const historyData = await historyRes.json() as any;
                    if (historyData.historyId) {
                        latestHistoryId = String(historyData.historyId);
                    }
                    for (const record of historyData.history || []) {
                        for (const added of record.messagesAdded || []) {
                            if (added?.message?.id) {
                                messageIds.push(added.message.id);
                            }
                        }
                    }
                    pageToken = historyData.nextPageToken;
                } else {
                    break;
                }
            } catch (historyErr) {
                console.warn(`[syncGmailInboundReplies] Failed to fetch history page for mailbox ${mailbox.id}:`, historyErr);
                break;
            }
        } while (pageToken);

        if (isStaleHistory) {
            try {
                const profileRes = await fetch("https://gmail.googleapis.com/gmail/v1/users/me/profile", {
                    headers: { Authorization: `Bearer ${accessToken}` },
                });
                if (profileRes.ok) {
                    const profileData = await profileRes.json() as any;
                    if (profileData.historyId) {
                        latestHistoryId = String(profileData.historyId);
                    }
                }
            } catch {
                // ignore profile fetch fallback error
            }
        }
    }

    if (messageIds.length === 0) {
        try {
            const listRes = await fetch(`https://gmail.googleapis.com/gmail/v1/users/me/messages?q=in:inbox&maxResults=10`, {
                headers: { Authorization: `Bearer ${accessToken}` },
            });
            if (listRes.ok) {
                const listData = await listRes.json() as any;
                messageIds = (listData.messages || []).map((m: any) => m.id);
            }
        } catch {
            // ignore list fallback error
        }
    }

    let syncedCount = 0;
    let replyCount = 0;
    let bounceCount = 0;

    const uniqueMsgIds = Array.from(new Set(messageIds));
    for (const msgId of uniqueMsgIds) {
        try {
            const msgRes = await fetch(`https://gmail.googleapis.com/gmail/v1/users/me/messages/${msgId}?format=full`, {
                headers: { Authorization: `Bearer ${accessToken}` },
            });
            if (!msgRes.ok) continue;
            const msg = await msgRes.json() as any;

            const headers = msg.payload?.headers || [];
            const getHeader = (name: string) => headers.find((h: any) => h.name?.toLowerCase() === name.toLowerCase())?.value || "";

            const from = getHeader("From");
            const subject = getHeader("Subject");
            const inReplyTo = getHeader("In-Reply-To");
            const references = getHeader("References");

            const fromMatch = from.match(/<([^>]+)>/) || [null, from.trim()];
            const fromEmail = (fromMatch[1] || "").toLowerCase();

            if (!fromEmail || fromEmail === mailbox.email.toLowerCase()) continue;

            const isBounce = /mailer-daemon|postmaster/i.test(from) || /delivery status notification|undeliver|delivery failed|returned mail/i.test(subject);
            const type = isBounce ? "BOUNCE" : "REPLY_RECEIVED";

            const refTokens = references.split(/\s+/).map((t: string) => t.trim()).filter(Boolean);
            const providerIds = Array.from(new Set([inReplyTo, ...refTokens].filter(Boolean)));

            const matchedEmail = await prisma.email.findFirst({
                where: {
                    mailboxId: mailbox.id,
                    lead: { teamId: mailbox.teamId },
                    OR: [
                        ...(msg.threadId ? [{ threadId: msg.threadId }] : []),
                        ...providerIds.map((providerId) => ({ providerId })),
                    ],
                },
                select: { id: true, leadId: true, campaignId: true },
            });

            if (!matchedEmail) continue;

            const existingEvent = await prisma.emailEvent.findFirst({
                where: {
                    teamId: mailbox.teamId,
                    provider: "GMAIL_API",
                    providerMessageId: msg.id,
                    type,
                },
            });

            if (existingEvent) continue;

            const emailEvent = await prisma.emailEvent.create({
                data: {
                    teamId: mailbox.teamId,
                    emailId: matchedEmail.id,
                    mailboxId: mailbox.id,
                    leadId: matchedEmail.leadId,
                    campaignId: matchedEmail.campaignId,
                    type,
                    provider: "GMAIL_API",
                    providerMessageId: msg.id,
                    payload: { from, subject, threadId: msg.threadId, gmailId: msg.id },
                },
            });

            if (isBounce) {
                bounceCount++;
                if (matchedEmail.leadId) {
                    const lead = await prisma.lead.findUnique({
                        where: { id: matchedEmail.leadId },
                        select: { email: true },
                    });

                    await prisma.lead.update({
                        where: { id: matchedEmail.leadId },
                        data: { status: "STOPPED" },
                    }).catch(() => undefined);

                    if (lead?.email) {
                        await prisma.suppressionEntry.upsert({
                            where: { teamId_email: { teamId: mailbox.teamId, email: lead.email.toLowerCase() } },
                            create: {
                                teamId: mailbox.teamId,
                                email: lead.email.toLowerCase(),
                                reason: "BOUNCE",
                                source: "GMAIL_SYNC",
                                leadId: matchedEmail.leadId,
                            },
                            update: {
                                reason: "BOUNCE",
                                source: "GMAIL_SYNC",
                                leadId: matchedEmail.leadId,
                            },
                        }).catch(() => undefined);
                    }
                }
                await prisma.email.update({
                    where: { id: matchedEmail.id },
                    data: { bouncedAt: new Date(), status: "bounced" },
                }).catch(() => undefined);
                await prisma.connectedMailbox.update({
                    where: { id: mailbox.id },
                    data: { bounceCount: { increment: 1 } },
                }).catch(() => undefined);
            } else {
                replyCount++;
                if (matchedEmail.leadId) {
                    await prisma.message.create({
                        data: {
                            leadId: matchedEmail.leadId,
                            content: subject || "Reply detected",
                            direction: "INBOUND",
                            platform: "EMAIL",
                            sender: from,
                            status: "received",
                            isRead: false,
                            emailEventId: emailEvent.id,
                        },
                    }).catch(() => undefined);

                    await prisma.lead.update({
                        where: { id: matchedEmail.leadId },
                        data: { status: "REPLIED" },
                    }).catch(() => undefined);
                }

                await prisma.email.update({
                    where: { id: matchedEmail.id },
                    data: { repliedAt: new Date(), status: "replied" },
                }).catch(() => undefined);

                await prisma.connectedMailbox.update({
                    where: { id: mailbox.id },
                    data: { replyCount: { increment: 1 } },
                }).catch(() => undefined);
            }

            syncedCount++;
        } catch (msgErr) {
            console.error(`[syncGmailInboundReplies] Error processing message ${msgId}:`, msgErr);
        }
    }

    await prisma.connectedMailbox.update({
        where: { id: mailbox.id },
        data: {
            ...(latestHistoryId ? { historyId: String(latestHistoryId) } : {}),
            lastSyncAt: new Date(),
        },
    }).catch(() => undefined);

    return { synced: syncedCount, replies: replyCount, bounces: bounceCount };
}

