import { Resolver } from "node:dns/promises";
import type { EmailBouncedEvent, EmailFailedEvent } from "resend";
import { isSharedMailDomain, tryNormalizeDomain } from "@/lib/crm/domain";

export type RecipientProvider = "gmail" | "outlook" | "yahoo" | "apple" | "other" | "unknown";

const MX_TTL_MS = 7 * 24 * 60 * 60 * 1000;
const resolver = new Resolver({ timeout: 2_000, tries: 1 });
const cache = new Map<string, { expiresAt: number; provider: Promise<RecipientProvider> }>();
const ADDRESS = /^[^@\s<>]+@[^@\s<>]+$/;

function recipientAddress(input?: string) {
    const value = input?.trim().toLowerCase();
    const address = value?.match(/<([^<>]+)>$/)?.[1] ?? value;
    return address && ADDRESS.test(address) ? address : undefined;
}

export function knownRecipientProvider(domain: string): RecipientProvider | undefined {
    if (!isSharedMailDomain(domain)) return undefined;
    const label = domain.split(".")[0];
    if (label === "gmail" || label === "googlemail") return "gmail";
    if (label === "outlook" || label === "hotmail" || label === "live" || label === "msn") return "outlook";
    if (label === "yahoo" || label === "ymail") return "yahoo";
    if (label === "icloud" || label === "me" || label === "mac") return "apple";
    return "other";
}

function mxProvider(exchange: string): RecipientProvider {
    const host = exchange.toLowerCase().replace(/\.$/, "");
    const endsIn = (domain: string) => host === domain || host.endsWith("." + domain);
    if (endsIn("google.com") || endsIn("googlemail.com")) return "gmail";
    if (endsIn("outlook.com")) return "outlook";
    if (endsIn("yahoodns.net")) return "yahoo";
    if (endsIn("icloud.com")) return "apple";
    return host ? "other" : "unknown";
}

export async function classifyRecipientProvider(input?: string, cacheOnly = false): Promise<RecipientProvider> {
    const domain = tryNormalizeDomain(recipientAddress(input)?.split("@")[1]);
    if (!domain) return "unknown";
    const known = knownRecipientProvider(domain);
    if (known) return known;

    const now = Date.now();
    const existing = cache.get(domain);
    if (existing && now < existing.expiresAt) return existing.provider;
    if (cacheOnly) return "unknown";
    cache.delete(domain);
    if (cache.size >= 10_000) {
        const oldest = cache.keys().next().value;
        if (oldest !== undefined) cache.delete(oldest);
    }
    const provider = resolver.resolveMx(domain).then((records) => {
        const preferred = records.sort((a, b) => a.priority - b.priority)[0];
        return preferred ? mxProvider(preferred.exchange) : "unknown";
    }, (): RecipientProvider => "unknown");
    cache.set(domain, { expiresAt: now + MX_TTL_MS, provider });
    return provider;
}

type FeedbackDetail = {
    bounce?: Partial<EmailBouncedEvent["data"]["bounce"]>;
    failed?: Partial<EmailFailedEvent["data"]["failed"]>;
};

function cleanDiagnostic(value: unknown) {
    if (typeof value !== "string") return undefined;
    return value.split(/[\r\n]/, 1)[0]?.trim()
        .replace(/https?:\/\/\S+/gi, "[url]")
        .replace(/[^\s<>()[\],;:"]+@[^\s<>()[\],;:"]+/g, "[email]")
        .slice(0, 500) || undefined;
}

function safeCode(value: unknown) {
    return typeof value === "string" && /^[A-Za-z][A-Za-z _-]{0,80}$/.test(value) ? value : undefined;
}

export async function resendFeedbackPayload(input: FeedbackDetail, address?: string, type?: string) {
    const recipient = recipientAddress(address);
    const recipientProvider = await classifyRecipientProvider(recipient);
    const detail: Record<string, string> = { recipientProvider };
    if (recipient) detail["recipient"] = recipient;
    if (type === "email.bounced") {
        const bounceType = safeCode(input.bounce?.type);
        const bounceSubType = safeCode(input.bounce?.subType);
        const message = cleanDiagnostic(input.bounce?.message);
        const smtpCode = message?.match(/\b([245]\d{2})(?:[ -]([245]\.\d{1,3}\.\d{1,3}))?\b/);
        if (bounceType) detail["bounceType"] = bounceType;
        if (bounceSubType) detail["bounceSubType"] = bounceSubType;
        if (message) detail["providerMessage"] = message;
        if (smtpCode?.[1]) detail["smtpCode"] = smtpCode[1];
        if (smtpCode?.[2]) detail["enhancedSmtpCode"] = smtpCode[2];
    }
    if (type === "email.failed") {
        const reason = safeCode(input.failed?.reason);
        if (reason) detail["failureReason"] = reason;
    }
    return detail;
}
