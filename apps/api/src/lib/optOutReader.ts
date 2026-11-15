// Reads an inbound reply for a request to stop being contacted. Deterministic only: no model, no
// database. Returns null when the text does not settle it, so the caller can ask the model.
//
// A wrong "opt out" silently kills a warm lead and a missed one is a compliance breach, so the
// patterns below are phrases, not bare words ("remove the slide" and "stopped by" are not opt-outs).

export type InboundClass = "OPT_OUT" | "NOT_INTERESTED" | "NOT_NOW" | "AUTO_REPLY" | "NEUTRAL" | "UNSURE";

export type OptOutReading = { class: InboundClass; pass: "deterministic" };

// Replies quote our own email, footer included. Only what the person wrote above the quote counts.
function ownText(body: string): string {
    const lines: string[] = [];
    for (const line of body.split(/\r?\n/)) {
        const t = line.trim();
        if (/^>/.test(t)) continue;
        if (/^on .{3,120} wrote:?$/i.test(t) || /^-{2,}\s*(original|forwarded) message\s*-{2,}$/i.test(t) || /^from:\s.+@/i.test(t)) break;
        lines.push(line);
    }
    return lines.join("\n");
}

function hasAutoReplyHeader(headers?: Record<string, string>): boolean {
    if (!headers) return false;
    const h = new Map(Object.entries(headers).map(([k, v]) => [k.toLowerCase(), String(v).trim().toLowerCase()]));
    const submitted = h.get("auto-submitted");
    if (submitted && submitted !== "no") return true;
    if (h.has("x-autoreply") || h.has("x-autorespond")) return true;
    return ["bulk", "junk", "auto_reply", "auto-reply"].includes(h.get("precedence") ?? "");
}

const AUTO_REPLY_TEXT = /\b(out of (the )?office|automatic(ally generated)? (reply|response)|auto[- ]?(reply|response|responder)|away from (my |the )?(desk|office|email)|on (annual )?leave until|no longer (works?|with) (at|the company))\b/i;

const OPT_OUT_PHRASES: RegExp[] = [
    /\bunsubscribe\b/i,
    /\bstop\s+(emailing|e-mailing|contacting|messaging|sending|texting|calling|writing)\b/i,
    /\bplease\s+stop(\s+(this|it|that|now))?\s*([.!,]|$)/im,
    /\b(remove|delete|drop|take)\s+(me|my (e-?mail|address|name|number|details))\b[^.\n]{0,40}\b(list|lists|database|mailing|records?|crm|contacts|distribution|off)\b/i,
    /\btake\s+me\s+off\b/i,
    /\b(do not|don'?t|dont|never)\s+(contact|email|e-mail|message|call|text)\s+(me|us)\b/i,
    /\bopt(ed)?[\s-]?(me\s+)?out\b/i,
    /\bno\s+more\s+(emails?|e-mails?|messages?|mails?)\b/i,
];

// Reads as a stop request only when it is the whole message ("STOP", "stop.").
const BARE_STOP = /^[\s"'*_.!-]*(stop|unsubscribe|remove|optout|opt out)[\s"'*_.!-]*$/i;

const NOT_INTERESTED = /\bnot\s+(really\s+)?interested\b|\bno\s+thanks?\b|\bwe(\s+a|')re\s+all\s+set\b/i;
const NOT_NOW = /\bnot\s+(right\s+)?now\b|\bnot\s+at\s+(the|this)\s+(moment|time)\b|\b(follow|circle|check)\s*(ing)?\s*(up|back)\b[^.\n]{0,30}\b(later|next|in|after)\b|\btry\s+(again\s+)?(in|next|after)\b|\bnext\s+(month|quarter|year)\b/i;

// Our own list of Romanised Hindi stop-ish phrases. We cannot read these reliably, so a person looks.
const HINGLISH_STOP = /\b(mat\s+(bhejo|bhejiye|karo|karna)|band\s+kar(o|na|iye)|nahi\s+chahiye|nahin\s+chahiye|mujhe\s+(nahi|nahin|mat))\b/i;
const NON_LATIN = /[ऀ-ॿ؀-ۿঀ-৿஀-௿ఀ-౿一-鿿Ѐ-ӿ]/;

export function readOptOut(input: { subject?: string; body: string; headers?: Record<string, string> }): OptOutReading | null {
    const done = (c: InboundClass): OptOutReading => ({ class: c, pass: "deterministic" });

    // An automatic message is never a request, whatever words it uses.
    if (hasAutoReplyHeader(input.headers)) return done("AUTO_REPLY");

    const text = ownText(input.body).trim();
    const subject = (input.subject ?? "").trim();

    if (AUTO_REPLY_TEXT.test(text) || AUTO_REPLY_TEXT.test(subject)) return done("AUTO_REPLY");

    if (BARE_STOP.test(text)) return done("OPT_OUT");
    if (OPT_OUT_PHRASES.some((p) => p.test(text))) return done("OPT_OUT");

    // "Not interested" ends this sequence but is not a permanent suppression.
    if (NOT_INTERESTED.test(text)) return done("NOT_INTERESTED");
    if (NOT_NOW.test(text)) return done("NOT_NOW");

    if (NON_LATIN.test(text) || HINGLISH_STOP.test(text)) return done("UNSURE");

    return null;
}
