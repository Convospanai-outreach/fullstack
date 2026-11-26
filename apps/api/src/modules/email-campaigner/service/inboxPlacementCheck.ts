// Inbox placement check: send one copy of a campaign's first email from a mailbox to a few test inboxes the operator
// owns, then read over IMAP which folder each copy landed in and what SPF/DKIM/DMARC the receiver reported.
//
// Rules this file keeps on purpose:
// - Read only. Messages are fetched with BODY.PEEK (never marked read), never replied to, starred, or moved out of spam
//   ("not spam"): that would be synthetic engagement, the pattern blocklists such as Validity Heatwave detect.
//   Each test copy is deleted after it is read.
// - Test sends never create Email/EmailEvent rows and use a tracking id no Email row has, so they cannot touch
//   deliverability stats, lead attribution or the reply inbox. They do count against the mailbox's daily cap.
// - State lives in ConnectedMailbox.metadata.placement, written with jsonb_set so every other metadata key
//   (Resend's inboundDomain, SMTP host settings...) is kept.
// - Test inboxes are WarmupSeedMailbox rows with status PLACEMENT (IMAP host/port/user, encrypted app password).
//   The seed warmup exchange only ever selects status ACTIVE, so it never sends to or from them.
import { randomUUID } from "node:crypto";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { JobQueue } from "@/lib/queue";
import { decryptCredential, type EncryptedCredential } from "@/lib/security/credentialVault";
import { parseDkimVerdict } from "./dkimProof";
import {
    inboxProviderFromHost,
    isSpamFolder,
    placementToken,
    placementVerdict,
    type PlacementFolder,
    type PlacementInboxResult,
    type PlacementVerdict,
} from "./inboxPlacementVerdict";

export const PLACEMENT_INBOX_STATUS = "PLACEMENT";
export const PLACEMENT_JOB_TYPE = "inbox_placement_check";
const MAX_INBOXES = 3; // a warming mailbox may only have 5 sends today
const RUN_COOLDOWN_MS = 60 * 60_000;
const WAIT_MS = 4 * 60_000;
const POLL_MS = 10_000;
const SUPPORTED_PROVIDERS = ["RESEND", "GOOGLE_WORKSPACE", "SMTP"] as const;

const stateSchema = z.object({
    runId: z.string(),
    status: z.enum(["queued", "running", "done", "failed"]),
    requestedBy: z.string().nullable(),
    startedAt: z.string(),
    checkedAt: z.string().nullable().default(null),
    campaignId: z.string().nullable().default(null),
    stepId: z.string().nullable().default(null),
    contentSource: z.enum(["campaign", "sample"]).default("sample"),
    sentTo: z.array(z.string()).nullable().default(null), // test inbox row ids, never addresses (customers can read this)
    token: z.string().nullable().default(null), // the search token of the sent copies, so a retry re-reads instead of resending
    results: z.array(z.any()).default([]),
    verdict: z.object({ level: z.enum(["green", "amber", "red"]), reasons: z.array(z.string()) }).nullable().default(null),
    error: z.string().nullable().default(null),
    // An admin accepted a red result (for example one test inbox misfiled a good email). Cleared by the next run.
    override: z.object({ by: z.string(), at: z.string() }).nullable().default(null),
});
export type PlacementState = z.infer<typeof stateSchema>;

export function readPlacementState(metadata: unknown): PlacementState | null {
    const raw = metadata && typeof metadata === "object" && !Array.isArray(metadata) ? (metadata as Record<string, unknown>)["placement"] : null;
    const parsed = stateSchema.safeParse(raw);
    return parsed.success ? parsed.data : null;
}

const STUCK_MS = 15 * 60_000; // the stale-job watchdog reclaims a job after 15 minutes too

// A queued or running check that has gone quiet for 15 minutes did not finish (worker restart, crash).
export function withStuckCheckFailed(state: PlacementState | null, now = new Date()): PlacementState | null {
    if (!state || (state.status !== "queued" && state.status !== "running")) return state;
    if (now.getTime() - Date.parse(state.startedAt) < STUCK_MS) return state;
    return { ...state, status: "failed", error: "The check did not finish. Run it again." };
}

// The verdict a campaign start sees: amber (never blocking) when no check has run or the last one is stale.
export function effectivePlacementVerdict(state: PlacementState | null, now = new Date()): PlacementVerdict {
    if (!state || state.status !== "done" || !state.checkedAt) return placementVerdict([], null, now);
    const checkedAt = new Date(state.checkedAt);
    if (!Number.isFinite(checkedAt.getTime())) return placementVerdict([], null, now);
    const verdict = placementVerdict(state.results as PlacementInboxResult[], checkedAt, now);
    if (verdict.level === "red" && state.override) {
        return { level: "amber", reasons: [`An admin accepted this result on ${state.override.at.slice(0, 10)}.`, ...verdict.reasons] };
    }
    return verdict;
}

// Lets an admin accept a fresh red result so campaigns can start; the problems stay listed.
export async function acceptPlacementResult(input: { teamId: string; mailboxId: string; userId: string; now?: Date }) {
    const mailbox = await prisma.connectedMailbox.findFirst({ where: { id: input.mailboxId, teamId: input.teamId }, select: { metadata: true } });
    if (!mailbox) throw new PlacementError("MAILBOX_NOT_FOUND", "Mailbox not found.");
    const state = readPlacementState(mailbox.metadata);
    if (!state || state.status !== "done" || state.verdict?.level !== "red") {
        throw new PlacementError("NOTHING_TO_ACCEPT", "Only a finished red check can be accepted.");
    }
    const accepted: PlacementState = { ...state, override: { by: input.userId, at: (input.now ?? new Date()).toISOString() } };
    await writePlacementState(input.teamId, input.mailboxId, accepted);
    // The override is cleared by the next run, so the audit log keeps who lifted this safety gate and why it was red.
    const { audit } = await import("@/lib/governance/audit");
    await audit({ actorId: input.userId, orgId: input.teamId, action: "PLACEMENT_RESULT_ACCEPTED", entity: "ConnectedMailbox", entityId: input.mailboxId,
        metadata: { runId: state.runId, checkedAt: state.checkedAt, reasons: state.verdict.reasons } });
    return accepted;
}

export async function writePlacementState(teamId: string, mailboxId: string, state: PlacementState) {
    const json = JSON.stringify(state);
    await prisma.$executeRaw`
        UPDATE "ConnectedMailbox"
        SET "metadata" = jsonb_set(
                CASE WHEN jsonb_typeof("metadata"::jsonb) = 'object' THEN "metadata"::jsonb ELSE '{}'::jsonb END,
                '{placement}', ${json}::jsonb, true),
            "updatedAt" = now()
        WHERE "id" = ${mailboxId} AND "teamId" = ${teamId}`;
}

export class PlacementError extends Error {
    constructor(public readonly code: "MAILBOX_NOT_FOUND" | "UNSUPPORTED_PROVIDER" | "NO_TEST_INBOXES" | "RATE_LIMITED" | "CAMPAIGN_NOT_FOUND" | "NOTHING_TO_ACCEPT", message: string) {
        super(message);
    }
}

interface Content { subject: string; body: string; stepId: string | null; campaignId: string | null; source: "campaign" | "sample" }

const SAMPLE = {
    subject: "Quick question about {{company|your team}}",
    body: "<p>Hi {{firstName|there}},</p><p>I came across {{company|your team}} and had a question about how you handle outreach today. Would a short call next week be useful?</p><p>Thanks,</p>",
};

// The first email step of the campaign's sequence; without a campaign, the team's most recently edited email step
// that sends from this mailbox (or any mailbox), and a neutral sample when the team has none yet.
async function resolveContent(teamId: string, mailboxId: string, campaignId: string | null): Promise<Content> {
    const emailStep = { stepType: "EMAIL", status: "ACTIVE", subject: { not: null }, body: { not: null } } as const;
    const select = { id: true, subject: true, body: true, sequence: { select: { campaignId: true } } } as const;
    const step = campaignId
        ? await prisma.sequenceStep.findFirst({ where: { teamId, ...emailStep, sequence: { campaignId, teamId } }, orderBy: { stepOrder: "asc" }, select })
        : (await prisma.sequenceStep.findFirst({ where: { teamId, ...emailStep, sequence: { teamId, senderMailboxIds: { has: mailboxId } } }, orderBy: { updatedAt: "desc" }, select }))
          ?? (await prisma.sequenceStep.findFirst({ where: { teamId, ...emailStep }, orderBy: { updatedAt: "desc" }, select }));
    if (step?.subject?.trim() && step.body?.trim()) {
        return { subject: step.subject, body: step.body, stepId: step.id, campaignId: step.sequence.campaignId ?? campaignId, source: "campaign" };
    }
    return { ...SAMPLE, stepId: null, campaignId, source: "sample" };
}

export async function requestPlacementCheck(input: { teamId: string; mailboxId: string; userId: string; campaignId?: string | null; now?: Date }) {
    const now = input.now ?? new Date();
    const mailbox = await prisma.connectedMailbox.findFirst({
        where: { id: input.mailboxId, teamId: input.teamId, status: "CONNECTED" },
        select: { id: true, provider: true, metadata: true },
    });
    if (!mailbox) throw new PlacementError("MAILBOX_NOT_FOUND", "That mailbox isn't connected.");
    if (!(SUPPORTED_PROVIDERS as readonly string[]).includes(mailbox.provider)) {
        throw new PlacementError("UNSUPPORTED_PROVIDER", "Placement checks work for Resend, Google Workspace and SMTP mailboxes.");
    }
    if (input.campaignId) {
        const campaign = await prisma.campaign.findFirst({ where: { id: input.campaignId, teamId: input.teamId }, select: { id: true } });
        if (!campaign) throw new PlacementError("CAMPAIGN_NOT_FOUND", "Campaign not found.");
    }
    const inboxes = await prisma.warmupSeedMailbox.count({ where: { status: PLACEMENT_INBOX_STATUS } });
    if (inboxes === 0) throw new PlacementError("NO_TEST_INBOXES", "No test inboxes are set up yet. An operator adds them in Super Admin.");

    const previous = withStuckCheckFailed(readPlacementState(mailbox.metadata), now);
    if (previous && previous.status !== "failed" && now.getTime() - Date.parse(previous.startedAt) < RUN_COOLDOWN_MS) {
        throw new PlacementError("RATE_LIMITED", "A placement check ran for this mailbox in the last hour. Try again later.");
    }

    const content = await resolveContent(input.teamId, mailbox.id, input.campaignId ?? null);
    const runId = randomUUID();
    const state: PlacementState = {
        runId, status: "queued", requestedBy: input.userId, startedAt: now.toISOString(), checkedAt: null,
        campaignId: content.campaignId, stepId: content.stepId, contentSource: content.source,
        sentTo: null, token: null, results: [], verdict: null, error: null, override: null,
    };
    await writePlacementState(input.teamId, mailbox.id, state);
    await JobQueue.enqueue(PLACEMENT_JOB_TYPE, { teamId: input.teamId, mailboxId: mailbox.id, runId }, {
        teamId: input.teamId, idempotencyKey: `${PLACEMENT_JOB_TYPE}:${mailbox.id}:${runId}`,
    });
    return state;
}

interface TestInbox { id: string; address: string; host: string; port: number; secure: boolean; user: string; password: string | null; provider: PlacementInboxResult["provider"] }

// Up to MAX_INBOXES, one per provider first so the verdict compares providers.
async function loadTestInboxes(): Promise<TestInbox[]> {
    const rows = await prisma.warmupSeedMailbox.findMany({ where: { status: PLACEMENT_INBOX_STATUS }, orderBy: { createdAt: "asc" } });
    const picked: typeof rows = [];
    const seen = new Set<string>();
    for (const row of rows) if (!seen.has(inboxProviderFromHost(row.host))) { seen.add(inboxProviderFromHost(row.host)); picked.push(row); }
    for (const row of rows) if (picked.length < MAX_INBOXES && !picked.includes(row)) picked.push(row);
    return Promise.all(picked.slice(0, MAX_INBOXES).map(async (row) => ({
        id: row.id, address: row.email, host: row.host, port: row.port, secure: row.secure || row.port === 993, user: row.user,
        password: (await decryptCredential(row.encryptedPassword as unknown as EncryptedCredential).catch(() => undefined)) ?? null,
        provider: inboxProviderFromHost(row.host),
    })));
}

async function renderHtml(teamId: string, body: string, token: string, trackingId: string) {
    const { resolveMessageTokens } = await import("./messageTokens");
    const { emailService, resolveEmailFooterText } = await import("./emailService");
    const team = await prisma.team.findUnique({ where: { id: teamId }, select: { mailingAddress: true, branding: true } });
    const resolved = resolveMessageTokens(body, {}, { useSuggestedFallbacks: true, html: true }).text;
    const publicBaseUrl = process.env["NEXT_PUBLIC_APP_URL"] || process.env["WEB_BASE_URL"] || process.env["NEXTAUTH_URL"]
        || (process.env.NODE_ENV === "production" ? "https://craftmyfunnel.live" : undefined);
    // The same footer, unsubscribe line and link wrapping a real campaign send gets, so the check measures what
    // recipients receive. addTrackingLinks is private to EmailService; bracket access is TypeScript's escape hatch.
    const unsubscribeUrl = publicBaseUrl ? `${publicBaseUrl.replace(/\/$/, "")}/api/email/unsubscribe/${trackingId}` : undefined;
    const withFooter = emailService["addTrackingLinks"](resolved, trackingId, publicBaseUrl, unsubscribeUrl, team?.mailingAddress, resolveEmailFooterText(team?.branding));
    return { html: `${withFooter}<p style="font-size:11px;color:#94a3b8">Ref ${token}</p>`, unsubscribeUrl };
}

async function sendCopy(input: { teamId: string; mailboxId: string; provider: string; to: string; subject: string; html: string; trackingId: string; unsubscribeUrl?: string | undefined }) {
    if (input.provider === "RESEND") {
        const { sendViaResendMailbox } = await import("./resendMailboxService");
        return sendViaResendMailbox({ teamId: input.teamId, mailboxId: input.mailboxId, to: input.to, subject: input.subject, html: input.html,
            trackingId: input.trackingId, ...(input.unsubscribeUrl ? { unsubscribeUrl: input.unsubscribeUrl } : {}) });
    }
    if (input.provider === "GOOGLE_WORKSPACE") {
        const { sendViaGmailMailbox } = await import("./googleMailboxService");
        return sendViaGmailMailbox({ teamId: input.teamId, mailboxId: input.mailboxId, to: input.to, subject: input.subject, html: input.html,
            ...(input.unsubscribeUrl ? { unsubscribeUrl: input.unsubscribeUrl } : {}) });
    }
    // SMTP sends do not reserve a daily slot themselves (see warmupSeedService), so reserve here.
    const { reserveMailboxSend, releaseMailboxSend } = await import("./googleMailboxService");
    const reservation = await reserveMailboxSend(input.teamId, input.mailboxId);
    if (!reservation.ok) return { success: false as const, error: reservation.reason };
    const { sendViaSmtpMailbox } = await import("./smtpConfigService");
    const outcome = await sendViaSmtpMailbox({ teamId: input.teamId, mailboxId: input.mailboxId, to: input.to, subject: input.subject, html: input.html });
    if (!outcome.success) await releaseMailboxSend(input.teamId, input.mailboxId);
    return outcome;
}

type Located = { folder: PlacementFolder; auth: PlacementInboxResult["auth"]; error?: string };

// Finds the copy by its token, reads it without marking it read, and deletes it. Never moves it between folders.
// Errors kept here are shown to the customer, so they never include the test inbox login details or server text.
export async function locateCopy(inbox: TestInbox, sender: string, token: string, since: Date, waitMs = WAIT_MS, pollMs = POLL_MS): Promise<Located> {
    if (!inbox.password) return { folder: "error", auth: null, error: "the test inbox password could not be decrypted" };
    // Loaded here: imapflow and mailparser cost the API about 12 MiB at boot (see dkimProof).
    const [{ ImapFlow }, { simpleParser }] = await Promise.all([import("imapflow"), import("mailparser")]);
    const client = new ImapFlow({ host: inbox.host, port: inbox.port, secure: inbox.secure, auth: { user: inbox.user, pass: inbox.password }, logger: false });
    try {
        await client.connect();
    } catch (error) {
        console.warn(`[placement] IMAP login failed for test inbox ${inbox.id}:`, error instanceof Error ? error.message : error);
        return { folder: "error", auth: null, error: "could not log in to the test inbox" };
    }

    // Reads one message by uid; null when it is not our copy (the sender fallback checks the token in the source).
    const read = async (uid: number, folder: { spam: boolean }, mustContainToken: boolean): Promise<Located | null> => {
        const message = await client.fetchOne(String(uid), { source: true }, { uid: true }); // source = BODY.PEEK[]: stays unread
        if (!message || !message.source) return null;
        if (mustContainToken && !message.source.toString("utf8").includes(token)) return null;
        const parsed = await simpleParser(message.source);
        const raw = parsed.headers.get("authentication-results");
        const lines = (Array.isArray(raw) ? raw : raw ? [raw] : []).map((v) => (typeof v === "string" ? v : ((v as { text?: string }).text ?? "")));
        const fromDomain = (parsed.from?.value[0]?.address ?? "").split("@")[1] ?? "";
        let placed: PlacementFolder = folder.spam ? "spam" : "inbox";
        if (!folder.spam && inbox.provider === "gmail") {
            const promo = await client.search({ gmraw: `category:promotions ${token}` }, { uid: true }).catch(() => []);
            if (Array.isArray(promo) && promo.length > 0) placed = "promotions";
        }
        await client.messageDelete(String(uid), { uid: true }).catch(() => undefined);
        return { folder: placed, auth: parseDkimVerdict(lines, fromDomain) };
    };

    try {
        const listed = await client.list();
        const spamFolders = listed.filter((f) => isSpamFolder(f)).map((f) => f.path);
        const folders: { path: string; spam: boolean }[] = [{ path: "INBOX", spam: false }, ...spamFolders.map((path) => ({ path, spam: true }))];
        const deadline = Date.now() + waitMs;
        for (;;) {
            for (const folder of folders) {
                const lock = await client.getMailboxLock(folder.path).catch(() => null);
                if (!lock) continue;
                try {
                    const byToken = await client.search({ body: token, since }, { uid: true });
                    const tokenUid = Array.isArray(byToken) ? byToken[byToken.length - 1] : undefined;
                    if (tokenUid) {
                        const hit = await read(tokenUid, folder, false);
                        if (hit) return hit;
                    }
                    // Some servers (Yahoo) index message bodies late: also look at the newest mail from this sender.
                    const bySender = await client.search({ from: sender, since }, { uid: true }).catch(() => []);
                    for (const uid of (Array.isArray(bySender) ? bySender : []).slice(-5).reverse()) {
                        const hit = await read(uid, folder, true);
                        if (hit) return hit;
                    }
                } finally {
                    lock.release();
                }
            }
            if (Date.now() + pollMs > deadline) {
                // Without a visible spam folder a copy filed as spam would look missing, hiding exactly what this check is for.
                if (spamFolders.length === 0) return { folder: "error", auth: null, error: "the spam folder of the test inbox is not visible over IMAP" };
                return { folder: "missing", auth: null };
            }
            await new Promise((resolve) => setTimeout(resolve, pollMs));
        }
    } catch (error) {
        console.warn(`[placement] IMAP read failed for test inbox ${inbox.id}:`, error instanceof Error ? error.message : error);
        return { folder: "error", auth: null, error: "the test inbox could not be read" };
    } finally {
        await client.logout().catch(() => undefined);
    }
}

// Worker entry. Never throws once a copy may have been sent, so a queue retry cannot send twice; a retry that finds
// the copies already sent only re-reads the inboxes with the stored token.
export async function runPlacementCheck(payload: { teamId?: unknown; mailboxId?: unknown; runId?: unknown }, timing = { waitMs: WAIT_MS, pollMs: POLL_MS }) {
    const teamId = typeof payload.teamId === "string" ? payload.teamId : null;
    const mailboxId = typeof payload.mailboxId === "string" ? payload.mailboxId : null;
    const runId = typeof payload.runId === "string" ? payload.runId : null;
    if (!teamId || !mailboxId || !runId) return { skipped: "invalid_payload" };

    const mailbox = await prisma.connectedMailbox.findFirst({ where: { id: mailboxId, teamId }, select: { provider: true, status: true, email: true, metadata: true } });
    let state = readPlacementState(mailbox?.metadata);
    if (!mailbox || !state || state.runId !== runId || state.status === "done" || state.status === "failed") return { skipped: "stale_run" };

    const fail = async (error: string) => {
        state = { ...state!, status: "failed", error };
        await writePlacementState(teamId, mailboxId, state);
        return { failed: error };
    };

    try {
        if (mailbox.status !== "CONNECTED") return await fail("The mailbox is no longer connected.");
        const inboxes = await loadTestInboxes();
        if (inboxes.length === 0) return await fail("No test inboxes are set up.");
        const since = new Date(Date.now() - 24 * 60 * 60_000);
        const readAll = (sentTo: string[], token: string, sendErrors: Record<string, string> = {}) =>
            Promise.all(inboxes.map(async (inbox): Promise<PlacementInboxResult> => {
                if (!sentTo.includes(inbox.id)) {
                    return { inbox: inbox.id, provider: inbox.provider, folder: "error", auth: null, error: `not sent${sendErrors[inbox.id] ? `: ${sendErrors[inbox.id]}` : ""}` };
                }
                const found = await locateCopy(inbox, mailbox.email, token, since, timing.waitMs, timing.pollMs);
                return { inbox: inbox.id, provider: inbox.provider, ...found };
            }));

        // A retry after the copies went out (worker restart): read the inboxes again, never send again.
        if (state.sentTo && state.token) return await finish(teamId, mailboxId, state, await readAll(state.sentTo, state.token));
        if (state.sentTo) return await fail("The check was interrupted after sending. Run it again in an hour.");

        const token = placementToken();
        state = { ...state, status: "running" };
        await writePlacementState(teamId, mailboxId, state);
        const content = await resolveContent(teamId, mailboxId, state.campaignId);
        const { resolveMessageTokens } = await import("./messageTokens");
        const subject = resolveMessageTokens(content.subject, {}, { useSuggestedFallbacks: true }).text;
        const trackingId = `placement-${runId}`; // no Email row has it, so opens, clicks or replies to it go nowhere
        const { html, unsubscribeUrl } = await renderHtml(teamId, content.body, token, trackingId);
        const sentTo: string[] = [];
        const sendErrors: Record<string, string> = {};
        for (const inbox of inboxes) {
            const outcome = await sendCopy({ teamId, mailboxId, provider: mailbox.provider, to: inbox.address, subject, html, trackingId, unsubscribeUrl })
                .catch((error: unknown) => ({ success: false as const, error: error instanceof Error ? error.message : "send failed" }));
            if (outcome.success) sentTo.push(inbox.id);
            else sendErrors[inbox.id] = String((outcome as { error?: unknown }).error ?? "send failed").split(inbox.address).join("the test inbox").slice(0, 120);
        }
        state = { ...state, sentTo, token };
        await writePlacementState(teamId, mailboxId, state);
        if (sentTo.length === 0) return await fail(`No test copy could be sent: ${Object.values(sendErrors)[0] ?? "send failed"}`);
        return await finish(teamId, mailboxId, state, await readAll(sentTo, token, sendErrors));
    } catch (error) {
        return fail(error instanceof Error ? error.message.slice(0, 200) : "The check failed.");
    }
}

async function finish(teamId: string, mailboxId: string, state: PlacementState, results: PlacementInboxResult[]) {
    const checkedAt = new Date();
    const verdict = placementVerdict(results, checkedAt, checkedAt);
    const done: PlacementState = { ...state, status: "done", checkedAt: checkedAt.toISOString(), results, verdict, error: null };
    await writePlacementState(teamId, mailboxId, done);
    return { level: verdict.level };
}
