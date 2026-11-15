// Mirrored in apps/web/src/lib/preSendCheck.ts (apps/web cannot import apps/api). The two files must
// stay identical; apps/web/tests/unit/pre-send-check-parity.test.ts fails when they differ.
//
// A deterministic check of a composed email before it is queued: no model, no cost. It runs on the
// draft BEFORE link tracking, the open pixel and the footer are added, so the link budget counts only
// the links the writer put there. The caller decides what to do with a failure (see `mode`).

export type SendKind = "sequence" | "reply";
export type SendSafetyMode = "off" | "warn" | "hold";

export interface SendSafetySettings {
    mode: SendSafetyMode;
    maxSubjectChars: number;
    maxBodyWords: number;
    maxLinks: number;
    bannedPhrases: string[];
    // Empty means "do not restrict": a team that has not listed its domains is not held for every link.
    allowedLinkHosts: string[];
    plainTextOnly: boolean;
}

// Our own starting list of spam triggers and phrases that read as machine-written. Teams edit it.
const DEFAULT_BANNED_PHRASES = [
    "act now",
    "100% free",
    "risk-free",
    "limited time offer",
    "no obligation",
    "make money fast",
    "click here",
    "i hope this email finds you well",
    "i hope this message finds you well",
    "in today's fast-paced world",
    "unlock the power",
    "game-changer",
    "i came across your profile",
];

export const DEFAULT_SEND_SAFETY: SendSafetySettings = {
    mode: "warn",
    maxSubjectChars: 150,
    maxBodyWords: 400,
    maxLinks: 1,
    bannedPhrases: DEFAULT_BANNED_PHRASES,
    allowedLinkHosts: [],
    plainTextOnly: false,
};

const MAX_LIST = 200;

function positiveInt(value: unknown, fallback: number): number {
    return typeof value === "number" && Number.isInteger(value) && value > 0 && value <= 100000 ? value : fallback;
}

function stringList(value: unknown, fallback: string[]): string[] {
    if (!Array.isArray(value)) return fallback;
    return value
        .filter((v): v is string => typeof v === "string")
        .map((v) => v.trim())
        .filter(Boolean)
        .slice(0, MAX_LIST);
}

// Reads Team.sendSafety. Anything missing or invalid falls back to the default, so a bad value can
// never throw in the send path.
export function resolveSendSafety(raw: unknown): SendSafetySettings {
    const r = raw && typeof raw === "object" ? (raw as Record<string, unknown>) : {};
    const mode: SendSafetyMode = r["mode"] === "off" || r["mode"] === "hold" || r["mode"] === "warn" ? r["mode"] : DEFAULT_SEND_SAFETY.mode;
    return {
        mode,
        maxSubjectChars: positiveInt(r["maxSubjectChars"], DEFAULT_SEND_SAFETY.maxSubjectChars),
        maxBodyWords: positiveInt(r["maxBodyWords"], DEFAULT_SEND_SAFETY.maxBodyWords),
        maxLinks: positiveInt(r["maxLinks"], DEFAULT_SEND_SAFETY.maxLinks),
        bannedPhrases: stringList(r["bannedPhrases"], DEFAULT_SEND_SAFETY.bannedPhrases),
        allowedLinkHosts: stringList(r["allowedLinkHosts"], DEFAULT_SEND_SAFETY.allowedLinkHosts),
        plainTextOnly: r["plainTextOnly"] === true,
    };
}

export type SendSafetyCode =
    | "BAD_RECIPIENT"
    | "EMPTY_SUBJECT"
    | "LONG_SUBJECT"
    | "EMPTY_BODY"
    | "LONG_BODY"
    | "UNRENDERED_TOKEN"
    | "BANNED_PHRASE"
    | "TOO_MANY_LINKS"
    | "FOREIGN_LINK"
    | "NO_POSTAL_ADDRESS"
    | "HTML_IN_PLAIN_TEXT";

export interface SendSafetyReason {
    code: SendSafetyCode;
    message: string;
}

export interface PreSendInput {
    to: string;
    subject: string;
    // The composed body before link tracking, the pixel and the footer.
    body: string;
    kind: SendKind;
    settings: SendSafetySettings;
    // Team.mailingAddress. The footer adds it later; this asserts there is one to add.
    postalAddress?: string | null;
}

function toText(html: string): string {
    return html
        .replace(/<(script|style)\b[^>]*>[\s\S]*?<\/\1>/gi, " ")
        .replace(/<[^>]*>/g, " ")
        .replace(/&nbsp;/gi, " ")
        .replace(/&amp;/gi, "&")
        .replace(/\s+/g, " ")
        .trim();
}

function escapeRegExp(s: string): string {
    return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function webLinks(body: string): string[] {
    const found: string[] = [];
    for (const m of body.matchAll(/href\s*=\s*["']([^"']+)["']/gi)) found.push(m[1]!.trim());
    // Bare URLs in the text. Anchor text is dropped first so a linked URL is not counted twice.
    const loose = toText(body.replace(/<a\b[^>]*>[\s\S]*?<\/a>/gi, " "));
    for (const m of loose.matchAll(/https?:\/\/[^\s<>"')]+/gi)) found.push(m[0]);
    return found.filter((u) => /^https?:\/\//i.test(u));
}

function normalizeHost(value: string): string {
    return value.trim().toLowerCase().replace(/^[a-z][a-z0-9+.-]*:\/\//, "").split(/[/?#]/)[0]!.replace(/^www\./, "").replace(/\.$/, "");
}

function hostOf(url: string): string | null {
    try {
        return normalizeHost(new URL(url).hostname);
    } catch {
        return null;
    }
}

export function preSendCheck(input: PreSendInput): { ok: boolean; reasons: SendSafetyReason[] } {
    const { settings, kind } = input;
    const reasons: SendSafetyReason[] = [];
    const add = (code: SendSafetyCode, message: string) => reasons.push({ code, message });

    const subject = input.subject.trim();
    const text = toText(input.body);

    if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(input.to.trim())) add("BAD_RECIPIENT", "The recipient address is not a valid email address.");

    if (!subject) add("EMPTY_SUBJECT", "The subject is empty.");
    else if (subject.length > settings.maxSubjectChars) add("LONG_SUBJECT", `The subject is ${subject.length} characters; the limit is ${settings.maxSubjectChars}.`);

    if (!text) add("EMPTY_BODY", "The email has no text.");
    else {
        const words = text.split(" ").length;
        if (words > settings.maxBodyWords) add("LONG_BODY", `The email is ${words} words; the limit is ${settings.maxBodyWords}.`);
    }

    if (/\{\{[^}]*\}\}/.test(subject) || /\{\{[^}]*\}\}/.test(input.body)) add("UNRENDERED_TOKEN", "A merge field was left unfilled (it still shows as {{...}}).");

    const haystack = `${subject} ${text}`;
    const hit = settings.bannedPhrases.find((p) => new RegExp(`(^|[^a-z0-9])${escapeRegExp(p)}([^a-z0-9]|$)`, "i").test(haystack));
    if (hit) add("BANNED_PHRASE", `The email contains "${hit}", which spam filters and readers distrust.`);

    const links = webLinks(input.body);
    if (kind === "sequence" && links.length > settings.maxLinks) add("TOO_MANY_LINKS", `The email has ${links.length} links; the limit for a cold email is ${settings.maxLinks}.`);

    if (settings.allowedLinkHosts.length > 0) {
        const allowed = settings.allowedLinkHosts.map(normalizeHost);
        const foreign = links.map(hostOf).find((h) => h === null || !allowed.some((a) => h === a || h.endsWith(`.${a}`)));
        if (foreign !== undefined) add("FOREIGN_LINK", `The email links to ${foreign ?? "an unreadable address"}, which is not on the allowed list.`);
    }

    if (kind === "sequence" && !input.postalAddress?.trim()) add("NO_POSTAL_ADDRESS", "No postal address is set for the team, so the required footer address would be missing.");

    if (settings.plainTextOnly && /<\/?[a-z][a-z0-9]*(\s[^>]*)?\/?>/i.test(input.body)) add("HTML_IN_PLAIN_TEXT", "The email contains HTML tags but the team sends plain text only.");

    return { ok: reasons.length === 0, reasons };
}
