import { randomBytes } from "node:crypto";
import { ImapFlow } from "imapflow";
import { simpleParser } from "mailparser";
import { prisma } from "@/lib/db";
import { sendViaSmtpMailbox } from "./smtpConfigService";

// Proves a mailbox really signs its mail: sends one message from it to an inbox this app can read over
// IMAP (the DKIM_PROOF_* settings), then reads what the receiving server wrote in Authentication-Results.
// A DNS check shows the record exists; this shows the provider signs with it and the receiver accepted it.
// Nothing is stored. It sends exactly one message per call, to an address the operator configured.

const POLL_EVERY_MS = 4000;
const WAIT_UP_TO_MS = 60000;

export type AuthMethodResult = "pass" | "fail" | "none" | "other";

export interface DkimProofVerdict {
    dkim: AuthMethodResult;
    // The domain the signature names (header.d). Aligned when it is the From domain or a parent of it.
    signingDomain: string | null;
    aligned: boolean;
    spf: AuthMethodResult;
    dmarc: AuthMethodResult;
}

export interface DkimProofConfig {
    address: string;
    host: string;
    port: number;
    user: string;
    password: string;
}

export function dkimProofConfigFromEnv(env: NodeJS.ProcessEnv = process.env): DkimProofConfig | null {
    const address = env["DKIM_PROOF_ADDRESS"];
    const host = env["DKIM_PROOF_IMAP_HOST"];
    const user = env["DKIM_PROOF_IMAP_USER"];
    const password = env["DKIM_PROOF_IMAP_PASSWORD"];
    if (!address || !host || !user || !password) return null;
    return { address, host, port: Number(env["DKIM_PROOF_IMAP_PORT"]) || 993, user, password };
}

function methodResult(header: string, method: string): AuthMethodResult {
    const match = header.match(new RegExp(`(?:^|[\\s;])${method}\\s*=\\s*([a-z]+)`, "i"));
    if (!match) return "none";
    const value = match[1]!.toLowerCase();
    return value === "pass" || value === "fail" || value === "none" ? value : "other";
}

const sameOrParent = (signing: string, fromDomain: string) => fromDomain === signing || fromDomain.endsWith(`.${signing}`);
const rank = (v: DkimProofVerdict) => (v.dkim === "pass" ? (v.aligned ? 3 : 2) : v.dkim === "none" ? 0 : 1);

// Reads Authentication-Results lines (a message can carry several, one per hop) and keeps the strongest
// DKIM result: a pass for an aligned domain wins.
export function parseDkimVerdict(authResults: readonly string[], fromDomain: string): DkimProofVerdict {
    const from = fromDomain.toLowerCase();
    let best: DkimProofVerdict = { dkim: "none", signingDomain: null, aligned: false, spf: "none", dmarc: "none" };
    for (const header of authResults) {
        for (const clause of header.split(";").filter((part) => /^\s*dkim\s*=/i.test(part))) {
            const signing = clause.match(/header\.d\s*=\s*([^\s;]+)/i)?.[1]?.toLowerCase() ?? null;
            const candidate = { ...best, dkim: methodResult(clause, "dkim"), signingDomain: signing, aligned: signing !== null && sameOrParent(signing, from) };
            if (rank(candidate) > rank(best)) best = candidate;
        }
        const spf = methodResult(header, "spf");
        const dmarc = methodResult(header, "dmarc");
        if (spf !== "none") best = { ...best, spf };
        if (dmarc !== "none") best = { ...best, dmarc };
    }
    return best;
}

export type DkimProofOutcome =
    | { ok: true; verdict: DkimProofVerdict }
    | { ok: false; code: "NOT_CONFIGURED" | "MAILBOX_NOT_FOUND" | "SEND_FAILED" | "NOT_RECEIVED" };

async function waitForMessage(config: DkimProofConfig, token: string): Promise<{ authResults: string[]; fromDomain: string } | null> {
    const client = new ImapFlow({
        host: config.host,
        port: config.port,
        secure: config.port === 993,
        auth: { user: config.user, pass: config.password },
        logger: false,
    });
    await client.connect();
    try {
        const deadline = Date.now() + WAIT_UP_TO_MS;
        while (Date.now() < deadline) {
            for (const folder of ["INBOX", "Junk", "Spam"]) {
                let lock;
                try {
                    lock = await client.getMailboxLock(folder);
                } catch {
                    continue;
                }
                try {
                    const found = await client.search({ subject: token }, { uid: true });
                    const uid = Array.isArray(found) ? found[found.length - 1] : undefined;
                    if (uid) {
                        const message = await client.fetchOne(String(uid), { source: true }, { uid: true });
                        if (message && message.source) {
                            const parsed = await simpleParser(message.source);
                            const raw = parsed.headers.get("authentication-results");
                            const values = Array.isArray(raw) ? raw : raw ? [raw] : [];
                            const lines = values.map((v) => (typeof v === "string" ? v : ((v as { text?: string }).text ?? "")));
                            const address = parsed.from?.value[0]?.address ?? "";
                            return { authResults: lines, fromDomain: address.split("@")[1] ?? "" };
                        }
                    }
                } finally {
                    lock.release();
                }
            }
            await new Promise((resolve) => setTimeout(resolve, POLL_EVERY_MS));
        }
        return null;
    } finally {
        await client.logout().catch(() => undefined);
    }
}

export async function proveDkim(input: { teamId: string; mailboxId: string }): Promise<DkimProofOutcome> {
    const config = dkimProofConfigFromEnv();
    if (!config) return { ok: false, code: "NOT_CONFIGURED" };

    const mailbox = await prisma.connectedMailbox.findFirst({
        where: { id: input.mailboxId, teamId: input.teamId, status: "CONNECTED", provider: "SMTP" },
        select: { id: true },
    });
    if (!mailbox) return { ok: false, code: "MAILBOX_NOT_FOUND" };

    const token = `dkim-proof-${randomBytes(6).toString("hex")}`;
    const sent = await sendViaSmtpMailbox({
        teamId: input.teamId,
        mailboxId: mailbox.id,
        to: config.address,
        subject: token,
        html: "<p>This message checks that this mailbox signs its mail. No reply is needed.</p>",
    });
    if (!sent.success) return { ok: false, code: "SEND_FAILED" };

    const received = await waitForMessage(config, token);
    if (!received) return { ok: false, code: "NOT_RECEIVED" };
    return { ok: true, verdict: parseDkimVerdict(received.authResults, received.fromDomain) };
}
