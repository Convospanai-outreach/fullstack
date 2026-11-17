import { lookupMx } from "@/modules/email-campaigner/service/dnsLookup";
import { verifyEmailWithHunter } from "@/integrations/hunter";

// Whether an address is worth cold-sending to. The ladder runs the cheapest checks first and stops at
// the first definitive answer, so the paid provider is only asked about what is left.

export type EmailStatus = "VERIFIED" | "RISKY" | "GUESS" | "INVALID" | "UNKNOWN";
export type EmailStatusSource = "SYNTAX" | "NO_MX" | "ROLE" | "HUNTER" | "BOUNCE" | "PATTERN";

export interface VerifyResult {
    status: EmailStatus;
    source: EmailStatusSource;
    usedProvider: boolean;
}

export interface VerifyDeps {
    lookupMx: (domain: string) => Promise<string[]>;
    providerVerify: (email: string) => Promise<{ status: string } | null>;
}

const defaultDeps: VerifyDeps = {
    lookupMx,
    providerVerify: (email) => verifyEmailWithHunter(email),
};

const SYNTAX = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
const ROLE_LOCALS = new Set([
    "info", "sales", "support", "admin", "contact", "hello", "office", "team", "help", "billing",
    "accounts", "marketing", "hr", "jobs", "careers", "press", "media", "enquiries", "inquiries",
    "webmaster", "postmaster", "abuse", "noreply", "no-reply", "service", "mail",
]);

// The steps that cost nothing: syntax, MX, role address. Null means only the provider can tell.
export async function freeEmailChecks(rawEmail: string, deps: Pick<VerifyDeps, "lookupMx"> = defaultDeps): Promise<VerifyResult | null> {
    const email = rawEmail.trim().toLowerCase();
    if (!SYNTAX.test(email)) return { status: "INVALID", source: "SYNTAX", usedProvider: false };
    const [local, domain] = email.split("@") as [string, string];

    try {
        if ((await deps.lookupMx(domain)).length === 0) return { status: "INVALID", source: "NO_MX", usedProvider: false };
    } catch {
        // A DNS outage says nothing about the domain; go on to the next step.
    }

    if (ROLE_LOCALS.has(local)) return { status: "RISKY", source: "ROLE", usedProvider: false };
    return null;
}

export async function verifyEmailAddress(rawEmail: string, deps: VerifyDeps = defaultDeps): Promise<VerifyResult> {
    const free = await freeEmailChecks(rawEmail, deps);
    if (free) return free;

    try {
        const answer = await deps.providerVerify(rawEmail.trim().toLowerCase());
        const status: EmailStatus =
            answer?.status === "valid" ? "VERIFIED" : answer?.status === "invalid" ? "INVALID" : answer?.status === "accept_all" ? "RISKY" : "UNKNOWN";
        return { status, source: "HUNTER", usedProvider: true };
    } catch {
        return { status: "UNKNOWN", source: "HUNTER", usedProvider: true };
    }
}

// Address patterns, tried in this order. The first one that explains a colleague's address is used.
const PATTERNS: Array<{ build: (first: string, last: string) => string }> = [
    { build: (f, l) => `${f}.${l}` },
    { build: (f) => f },
    { build: (f, l) => `${f[0]}${l}` },
    { build: (f, l) => `${f}${l}` },
    { build: (f, l) => `${f}_${l}` },
];

function nameParts(fullName: string): { first: string; last: string } | null {
    const words = fullName
        .toLowerCase()
        .normalize("NFD")
        .replace(/[̀-ͯ]/g, "")
        .split(/\s+/)
        .map((w) => w.replace(/[^a-z]/g, ""))
        .filter(Boolean);
    return words.length >= 2 ? { first: words[0]!, last: words[words.length - 1]! } : null;
}

// An address built from the pattern that verified colleagues at the same domain use. It is only a GUESS
// until a provider check passes: nobody has seen mail delivered to it.
export function guessEmail(
    fullName: string,
    domain: string,
    verifiedColleagues: Array<{ fullName: string; email: string }>
): { email: string; status: "GUESS"; source: "PATTERN" } | null {
    const target = nameParts(fullName);
    if (!target) return null;
    const host = domain.trim().toLowerCase();

    for (const colleague of verifiedColleagues) {
        const [local, colleagueDomain] = colleague.email.toLowerCase().split("@");
        const parts = nameParts(colleague.fullName);
        if (!local || colleagueDomain !== host || !parts) continue;
        const pattern = PATTERNS.find((p) => p.build(parts.first, parts.last) === local);
        if (pattern) return { email: `${pattern.build(target.first, target.last)}@${host}`, status: "GUESS", source: "PATTERN" };
    }
    return null;
}
