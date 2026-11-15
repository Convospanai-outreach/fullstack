import { hostAllowed, linkHostsIn } from "./linkHosts";

// Checks on an AI-written draft that is about to go out without a human reading it. Pure: the
// caller loads the team's owned hosts and the known contact details, and decides what a hit means.

export type HoldbackCode = "FOREIGN_LINK" | "INSTRUCTION_LEAK" | "FOREIGN_CONTACT";
export type Holdback = { code: HoldbackCode; message: string };

export type HoldbackInput = {
    subject?: string;
    body: string;
    /** Hosts the team owns. Empty means every link is foreign. */
    ownedHosts: string[];
    /** Prompt text the draft must not repeat. */
    protectedTexts: string[];
    /** Contact details the draft may mention: the lead's and the sender's. */
    knownContacts: { emails: string[]; phones: string[] };
};

const LEAK_RUN = 12;
const EMAIL = /[\p{L}\p{N}._%+-]+@[\p{L}\p{N}-]+(?:\.[\p{L}\p{N}-]+)+/gu;
const PHONE = /\+?\d[\d\s().-]{6,}\d/g;
const DATE_LIKE = /^\d{1,4}[-.]\d{1,2}[-.]\d{1,4}$/;

const words = (text: string) => text.toLowerCase().match(/[\p{L}\p{N}']+/gu) ?? [];

function runs(text: string): Set<string> {
    const w = words(text);
    const out = new Set<string>();
    for (let i = 0; i + LEAK_RUN <= w.length; i++) out.add(w.slice(i, i + LEAK_RUN).join(" "));
    return out;
}

function leaksPrompt(draft: string, protectedTexts: string[]): boolean {
    const draftRuns = runs(draft);
    if (!draftRuns.size) return false;
    return protectedTexts.some((p) => [...runs(p)].some((r) => draftRuns.has(r)));
}

const digitsOf = (s: string) => s.replace(/\D/g, "");

function phoneKnown(digits: string, known: string[]): boolean {
    return known.map(digitsOf).some((k) => k === digits || (Math.min(k.length, digits.length) >= 7 && (k.endsWith(digits) || digits.endsWith(k))));
}

export function findHoldbacks(input: HoldbackInput): Holdback[] {
    const text = [input.subject ?? "", input.body].join("\n");
    const out: Holdback[] = [];

    const foreign = linkHostsIn(text).filter((h) => !hostAllowed(h, input.ownedHosts));
    if (foreign.length) {
        const names = [...new Set(foreign.map((h) => h ?? "a link that could not be read"))].join(", ");
        out.push({ code: "FOREIGN_LINK", message: `Links to ${names}, which this team does not own.` });
    }

    if (leaksPrompt(text, input.protectedTexts)) {
        out.push({ code: "INSTRUCTION_LEAK", message: "Repeats a long passage of the writing instructions." });
    }

    // A phone-like run inside a link (a decimal IP, an id in a path) is the link's business, not a contact detail.
    const contactText = text.replace(/\b[a-z][a-z0-9+.-]*:\/\/\S*/gi, " ");
    const knownEmails = new Set(input.knownContacts.emails.map((e) => e.toLowerCase()));
    const badEmails = (contactText.match(EMAIL) ?? []).filter((e) => !knownEmails.has(e.toLowerCase()));
    const badPhones = (contactText.match(PHONE) ?? []).filter((raw) => {
        const digits = digitsOf(raw);
        return digits.length >= 8 && digits.length <= 15 && !DATE_LIKE.test(raw.trim()) && !phoneKnown(digits, input.knownContacts.phones);
    });
    if (badEmails.length || badPhones.length) {
        out.push({
            code: "FOREIGN_CONTACT",
            message: `Mentions contact details that are not the lead's or the sender's: ${[...badEmails, ...badPhones.map((p) => p.trim())].join(", ")}.`,
        });
    }
    return out;
}
