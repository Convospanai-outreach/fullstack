// Sends real send/receive traffic between a customer's warming-up ConnectedMailbox and a
// platform-owned pool of dedicated seed mailboxes (WarmupSeedMailbox), so a new mailbox builds
// sender reputation with real accepted deliveries and reciprocal replies instead of sitting
// idle until the customer's first real campaign. Only reaches Gmail/SMTP mailboxes today -
// the same provider scope emailService.sendEmail() itself supports; Microsoft 365/Resend
// mailboxes are skipped, not a regression introduced here.
import { prisma } from "@/lib/db";
import { assertMailboxCanSend, reserveMailboxSend, releaseMailboxSend, sendViaGmailMailbox } from "./googleMailboxService";
import { getSmtpConfig } from "./smtpConfigService";
import { sendViaSMTP } from "@/lib/email/smtpClient";
import { JobQueue } from "@/lib/queue";

const ENCRYPTION_KEY = process.env["ENCRYPTION_KEY"] || "";

type EncryptedSecret = { v: number; cipher: string; iv: string; tag: string };

function getKey(): Buffer {
    if (!ENCRYPTION_KEY || ENCRYPTION_KEY.length < 32) {
        throw new Error("ENCRYPTION_KEY must be set to a 32-byte hex string");
    }
    return Buffer.from(ENCRYPTION_KEY, "hex");
}

export async function encryptSeedSecret(value: string): Promise<EncryptedSecret> {
    const crypto = await import("crypto");
    const key = getKey();
    const iv = crypto.randomBytes(12);
    const cipher = crypto.createCipheriv("aes-256-gcm", key, iv);
    const encrypted = Buffer.concat([cipher.update(value, "utf8"), cipher.final()]);
    const tag = cipher.getAuthTag();
    return { v: 1, cipher: encrypted.toString("base64"), iv: iv.toString("base64"), tag: tag.toString("base64") };
}

async function decryptSeedSecret(secret: EncryptedSecret): Promise<string> {
    const crypto = await import("crypto");
    const key = getKey();
    const iv = Buffer.from(secret.iv, "base64");
    const tag = Buffer.from(secret.tag, "base64");
    const decipher = crypto.createDecipheriv("aes-256-gcm", key, iv);
    decipher.setAuthTag(tag);
    const decrypted = Buffer.concat([decipher.update(Buffer.from(secret.cipher, "base64")), decipher.final()]);
    return decrypted.toString("utf8");
}

const SEED_TEMPLATES = [
    { subject: "Quick question", body: "Hey, hope you're doing well. Wanted to follow up when you get a chance." },
    { subject: "Following up", body: "Just circling back on this - let me know what you think." },
    { subject: "Checking in", body: "Hi there, checking in to see how things are going on your end." },
    { subject: "Quick note", body: "Hope your week is going well. Wanted to touch base." },
    { subject: "Re: your update", body: "Thanks for the update - sounds good, appreciate you letting me know." },
];

const SEED_REPLY_BODIES = [
    "Thanks for reaching out - all good here, appreciate it.",
    "Got it, thanks! Talk soon.",
    "Sounds good, thanks for the note.",
    "Appreciate you following up - all set on my end.",
];

function pickRandom<T>(items: T[]): T {
    return items[Math.floor(Math.random() * items.length)] as T;
}

function startOfToday(): Date {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    return today;
}

async function pickEligibleSeedMailbox() {
    const today = startOfToday();
    const candidates = await prisma.warmupSeedMailbox.findMany({ where: { status: "ACTIVE" } });
    const eligible = candidates.filter((seed: any) => {
        const sentTodayDate = seed.sentTodayDate ? new Date(seed.sentTodayDate) : null;
        const sentToday = sentTodayDate && sentTodayDate >= today ? seed.sentToday : 0;
        return sentToday < seed.dailyCapacity;
    });
    if (eligible.length === 0) return null;
    return pickRandom(eligible);
}

async function bumpSeedMailboxCounter(id: string) {
    const today = startOfToday();
    const seed = await prisma.warmupSeedMailbox.findUnique({ where: { id } });
    if (!seed) return;
    const sentTodayDate = seed.sentTodayDate ? new Date(seed.sentTodayDate) : null;
    const shouldReset = !sentTodayDate || sentTodayDate < today;
    await prisma.warmupSeedMailbox.update({
        where: { id },
        data: {
            sentTodayDate: today,
            sentToday: shouldReset ? 1 : { increment: 1 },
            lastSentAt: new Date(),
        },
    });
}

async function sendFromWarmingMailbox(mailbox: any, to: string, subject: string, html: string): Promise<boolean> {
    if (mailbox.provider === "GOOGLE_WORKSPACE") {
        // sendViaGmailMailbox reserves/marks this mailbox's daily send quota atomically
        // itself - the caller must not also mark it, or a warmup send gets double-counted.
        const outcome = await sendViaGmailMailbox({ teamId: mailbox.teamId, mailboxId: mailbox.id, to, subject, html });
        return outcome.success;
    }
    const config = await getSmtpConfig(mailbox.teamId);
    if (!config) return false;
    const result = await sendViaSMTP(config, { to, subject, html });
    return result.success;
}

// Runs on a tick from worker-manager: gives each warming mailbox one chance to exchange a
// warmup email with a random seed mailbox, respecting the exact same daily/throttle guard
// real campaign sends use, so seed traffic can never push a mailbox past its ramped warmup
// limit - even under concurrent ticks (see reserveMailboxSend in googleMailboxService.ts).
export async function sendWarmupSeedTraffic(limit = 25) {
    const warmingMailboxes = await prisma.connectedMailbox.findMany({
        where: { isWarmingUp: true, status: "CONNECTED" },
        take: limit,
    });

    let sent = 0;
    for (const mailbox of warmingMailboxes) {
        // Cheap pre-filter only - not the enforcement point, so it's fine that this read can
        // race with another tick. Real enforcement happens per-provider below.
        const check = await assertMailboxCanSend(mailbox.teamId, mailbox.id);
        if (!check.ok) continue;

        const seed = await pickEligibleSeedMailbox();
        if (!seed) break; // pool exhausted for today - no point checking further mailboxes

        // Gmail sends reserve/mark this mailbox's quota atomically inside
        // sendViaGmailMailbox; SMTP has no such built-in accounting, so we have to reserve
        // the slot here ourselves before attempting the send (see OPEN-105).
        const isGmail = mailbox.provider === "GOOGLE_WORKSPACE";
        if (!isGmail) {
            const reservation = await reserveMailboxSend(mailbox.teamId, mailbox.id);
            if (!reservation.ok) continue;
        }

        const template = pickRandom(SEED_TEMPLATES);
        let success: boolean;
        try {
            success = await sendFromWarmingMailbox(mailbox, seed.email, template.subject, `<p>${template.body}</p>`);
        } catch {
            success = false;
        }
        if (!success) {
            if (!isGmail) await releaseMailboxSend(mailbox.teamId, mailbox.id);
            continue;
        }

        await bumpSeedMailboxCounter(seed.id);
        sent += 1;

        // A minority of exchanges get a reply-back from the seed mailbox on a random delay,
        // so the traffic looks like real reciprocal engagement rather than one-way silence.
        if (Math.random() < 0.4) {
            const delayMinutes = 5 + Math.floor(Math.random() * 115);
            await JobQueue.enqueue(
                "warmup_seed_reply",
                { seedMailboxId: seed.id, toEmail: mailbox.email, subject: `Re: ${template.subject}` },
                { processAt: new Date(Date.now() + delayMinutes * 60000) },
            );
        }
    }

    return { sent };
}

export async function sendWarmupSeedReply(payload: { seedMailboxId?: string; toEmail?: string; subject?: string }) {
    if (!payload.seedMailboxId || !payload.toEmail) {
        throw new Error("warmup_seed_reply payload is missing seedMailboxId/toEmail");
    }
    const seed = await prisma.warmupSeedMailbox.findUnique({ where: { id: payload.seedMailboxId } });
    if (!seed || seed.status !== "ACTIVE") {
        return { skipped: true, reason: "seed_mailbox_unavailable" };
    }

    const password = await decryptSeedSecret(seed.encryptedPassword as unknown as EncryptedSecret);
    const result = await sendViaSMTP(
        { host: seed.host, port: seed.port, secure: seed.secure, user: seed.user, password, fromName: seed.fromName, fromEmail: seed.email },
        { to: payload.toEmail, subject: payload.subject || "Re:", html: `<p>${pickRandom(SEED_REPLY_BODIES)}</p>` },
    );

    if (result.success) {
        await bumpSeedMailboxCounter(seed.id);
    }
    return result;
}
