import { resolve4 } from "node:dns/promises";
import type { RecipientProvider } from "@/modules/email-campaigner/service/resendFeedback";

export type ReputationLevel = "OK" | "WARNING" | "CRITICAL";
export type BlocklistStatus = "LISTED" | "CLEAR" | "UNKNOWN";
export type ReputationCounts = {
    sent: number; bounced: number; hardBounced: number; complained: number; delayed: number; failed: number;
};
export type DomainReputation = { dnsAlarm?: boolean; blocklist?: BlocklistStatus; resendStatus?: string };
export type ReputationSignal = {
    level: Exclude<ReputationLevel, "OK">;
    code: "complaint_hard_stop" | "complaint" | "hard_bounce" | "bounce" | "blocklist" | "resend_failed" | "dns" | "delay" | "failure";
    count?: number;
    sent?: number;
    recipientProvider?: RecipientProvider;
};
export type ProviderCounts = Partial<Record<RecipientProvider, ReputationCounts>>;

function rateAtLeast(count: number, sent: number, basisPoints: number) {
    return sent > 0 && count * 10_000 >= sent * basisPoints;
}

function rateSignals(c: ReputationCounts, recipientProvider?: RecipientProvider): ReputationSignal[] {
    const signals: ReputationSignal[] = [];
    const add = (level: ReputationSignal["level"], code: ReputationSignal["code"], count: number) => {
        signals.push({ level, code, count, sent: c.sent, ...(recipientProvider ? { recipientProvider } : {}) });
    };
    if (c.complained >= 2 && rateAtLeast(c.complained, c.sent, 30)) add("CRITICAL", "complaint_hard_stop", c.complained);
    else if (c.complained >= 3 && rateAtLeast(c.complained, c.sent, 8)) add("CRITICAL", "complaint", c.complained);
    else if (c.complained >= 2 && rateAtLeast(c.complained, c.sent, 4)) add("WARNING", "complaint", c.complained);
    if (c.sent >= 50 && rateAtLeast(c.hardBounced, c.sent, 400)) add("CRITICAL", "hard_bounce", c.hardBounced);
    else if (c.sent >= 30 && rateAtLeast(c.bounced, c.sent, 200)) add("WARNING", "bounce", c.bounced);
    if (c.sent >= 50 && rateAtLeast(c.delayed, c.sent, 500)) add("WARNING", "delay", c.delayed);
    if (rateAtLeast(c.failed, c.sent, 200)) add("WARNING", "failure", c.failed);
    return signals;
}

export function assessMailboxReputation(counts: ReputationCounts, providers: ProviderCounts = {}, domain: DomainReputation = {}): { level: ReputationLevel; signals: ReputationSignal[] } {
    const signals = rateSignals(counts);
    for (const [provider, providerCounts] of Object.entries(providers)) {
        if (provider !== "unknown") signals.push(...rateSignals(providerCounts, provider as RecipientProvider));
    }
    if (domain.blocklist === "LISTED") signals.push({ level: "CRITICAL", code: "blocklist" });
    if (domain.resendStatus === "failed") signals.push({ level: "CRITICAL", code: "resend_failed" });
    if (domain.dnsAlarm) signals.push({ level: "WARNING", code: "dns" });
    const ordered = [
        ...signals.filter((signal) => signal.level === "CRITICAL"),
        ...signals.filter((signal) => signal.level === "WARNING"),
    ];
    const level: ReputationLevel = ordered[0]?.level ?? "OK";
    return { level, signals: ordered };
}

let loggedRefusal = false;

export async function lookupSpamhausDbl(domain: string, lookup: (name: string) => Promise<string[]> = resolve4): Promise<BlocklistStatus> {
    let timer: ReturnType<typeof setTimeout> | undefined;
    try {
        const ips = await Promise.race([
            lookup(domain + ".dbl.spamhaus.org"),
            new Promise<null>((resolve) => { timer = setTimeout(() => resolve(null), 3_000); }),
        ]);
        if (!ips) return "UNKNOWN";
        if (ips.some((ip) => ip.startsWith("127.255.255."))) {
            if (!loggedRefusal) {
                loggedRefusal = true;
                console.warn("[MailboxReputation] Spamhaus DBL refused the resolver.");
            }
            return "UNKNOWN";
        }
        return ips.some((ip) => ip.startsWith("127.0.1.")) ? "LISTED" : "UNKNOWN";
    } catch (error) {
        return (error as { code?: string }).code === "ENOTFOUND" ? "CLEAR" : "UNKNOWN";
    } finally {
        clearTimeout(timer);
    }
}
