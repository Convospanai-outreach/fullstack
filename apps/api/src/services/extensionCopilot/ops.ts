// The AI operations the LinkedIn copilot extension calls (POST /extension/brain/<op>).
// Response shapes are what the extension already parses. The model call is injected (Ask) so the
// route decides billing and provider: screening asks are free ("small"), anything a prospect will
// read is billed ("large"). Deterministic checks in ./safety run before and after the model.

import { cleanText, draftProblems, injection, parseJson, sensitive } from "./safety";

export type AskTier = "small" | "large";
export type Ask = (req: { tier: AskTier; system: string; user: string; json?: boolean }) => Promise<string>;

/** Thrown by an Ask when the prompt itself is refused (policy); the op answers with its safe default. */
export class PromptBlockedError extends Error {}

const clip = (s: unknown, n: number) => String(s ?? "").slice(0, n);
const str = (v: unknown) => (typeof v === "string" ? v : "");
const words = (n: unknown) => Math.max(10, Math.min(200, Number(n) || 60));
const isObj = (v: unknown): v is Record<string, any> => !!v && typeof v === "object" && !Array.isArray(v);

function voice(s: Record<string, any> = {}) {
    return [
        s.persona && `You are writing as: ${clip(s.persona, 300)}.`,
        `Tone: ${clip(s.tone, 120) || "friendly, concise"}. Language: ${clip(s.language, 40) || "English"}.`,
        s.allowEmoji ? "One emoji at most." : "No emoji.",
        "No hashtags. Never mention AI. Sound like a real person, not a marketer.",
        s.customInstructions && `Also: ${clip(s.customInstructions, 500)}`
    ].filter(Boolean).join("\n");
}

/**
 * A JSON answer that passes validate. Tries the tier, retries once, then the large model; when
 * every answer is malformed (or the prompt is refused) returns the safe fallback, never a guess.
 */
async function jsonAsk<T>(ask: Ask, tier: AskTier, system: string, user: string, validate: (o: any) => T | null, fallback: T): Promise<T> {
    const tiers: AskTier[] = tier === "large" ? ["large", "large"] : ["small", "small", "large"];
    for (const t of tiers) {
        try {
            const ok = validate(parseJson(await ask({ tier: t, system: `${system}\nAnswer with one JSON object only.`, user, json: true })));
            if (ok) return ok;
        } catch (e) {
            if (e instanceof PromptBlockedError) return fallback;
            throw e;
        }
    }
    return fallback;
}

async function write(ask: Ask, system: string, user: string, maxLen: number): Promise<string> {
    try {
        const text = cleanText(await ask({ tier: "large", system, user }));
        return draftProblems(text, maxLen).length ? "" : text;
    } catch (e) {
        if (e instanceof PromptBlockedError) return "";
        throw e;
    }
}

const postText = (p: Record<string, any> = {}) => `Post by ${clip(p.author, 120)} (${clip(p.headline, 200)}):\n${clip(p.text, 3000)}`;

function writeComment(ask: Ask, s: Record<string, any>, about: string, lines: unknown, extra = "") {
    const system = `${voice(s)}\nWrite a LinkedIn comment of at most ${words(s.maxWords)} words in ${Number(lines) || 2} short sentence(s). Add something specific to the post; no generic praise.${extra}`;
    return write(ask, system, about, 1250);
}

// ---------------------------------------------------------------- Auto comment
export async function commentorComment(ask: Ask, body: Record<string, any>) {
    const s = isObj(body.settings) ? body.settings : {};
    const post = isObj(body.post) ? body.post : {};
    const favourite = isObj(body.favourite) ? body.favourite : null;
    if (injection(post.text)) return { relevant: false, reason: "post tries to instruct AI tools", comment: "" };
    if (!favourite) {
        const topics = Array.isArray(s.topics) ? s.topics.map((t: unknown) => clip(t, 60)).join(", ") : "";
        const gate = await jsonAsk(ask, "small",
            `Decide if a LinkedIn post is worth a thoughtful comment from someone interested in: ${topics || "their field"}. Reply {"relevant":true|false,"reason":"<short>"}. Not relevant: job ads, giveaways, engagement bait, politics, tragedy.`,
            postText(post),
            (o) => (o && typeof o.relevant === "boolean" ? { relevant: o.relevant as boolean, reason: clip(str(o.reason), 200) } : null),
            { relevant: false, reason: "could not judge relevance" });
        if (!gate.relevant) return { relevant: false, reason: gate.reason, comment: "" };
    }
    const comment = await writeComment(ask, s, postText(post), s.commentLines,
        favourite?.note ? `\nAbout this person: ${clip(favourite.note, 300)}` : "");
    return comment
        ? { relevant: true, reason: favourite ? "favourite" : "on topic", comment }
        : { relevant: false, reason: "no safe comment written", comment: "" };
}

export async function commentorReply(ask: Ask, body: Record<string, any>) {
    const s = isObj(body.settings) ? body.settings : {};
    const d = isObj(body.data) ? body.data : {};
    const theirs = str(d.theirReply);
    if (injection(theirs) || sensitive(theirs)) return { skip: true, reason: "needs a human", comment: "" };
    const gate = await jsonAsk(ask, "small",
        'Someone replied to my LinkedIn comment. Does it need an answer? Short thanks, emoji or likes do not. Reply {"skip":true|false,"reason":"<short>"}.',
        `My comment: ${clip(d.myComment, 800)}\n${clip(d.theirName, 80)} replied: ${clip(theirs, 800)}`,
        (o) => (o && typeof o.skip === "boolean" ? { skip: o.skip as boolean, reason: clip(str(o.reason), 200) } : null),
        { skip: true, reason: "could not judge" });
    if (gate.skip) return { skip: true, reason: gate.reason, comment: "" };
    const comment = await writeComment(ask, s,
        `${postText({ author: d.postAuthor, text: d.postText })}\n\nEarlier thread:\n${clip(d.thread, 1200)}\nMy comment: ${clip(d.myComment, 800)}\n${clip(d.theirName, 80)} replied: ${clip(theirs, 800)}\n\nWrite my reply to ${clip(d.theirName, 80)}.`,
        s.replyLines || 1);
    return comment ? { skip: false, reason: "answer", comment } : { skip: true, reason: "no safe reply written", comment: "" };
}

// ---------------------------------------------------------------- Lead Hunter
export async function commentorLead(ask: Ask, body: Record<string, any>) {
    const s = isObj(body.settings) ? body.settings : {};
    const post = isObj(body.post) ? body.post : {};
    if (injection(post.text)) return { isLead: false, reason: "post tries to instruct AI tools", need: "", comment: "" };
    const screen = await jsonAsk(ask, "small",
        `You screen LinkedIn posts for buying intent. A lead is: ${clip(s.leadCriteria, 500) || "someone who needs a service provider"}.
Not a lead: job seekers, recruiters posting jobs, people offering the same service, vague discussion.
Reply {"isLead":true|false,"reason":"<short>","need":"<what they need, 3-8 words, empty if not a lead>"}.`,
        postText(post),
        (o) => (o && typeof o.isLead === "boolean" ? { isLead: o.isLead as boolean, reason: clip(str(o.reason), 200), need: clip(str(o.need), 120) } : null),
        { isLead: false, reason: "could not judge", need: "" });
    if (!screen.isLead) return { ...screen, need: "", comment: "" };
    const comment = s.leadComment === false ? "" : await writeComment(ask, s, postText(post), s.leadCommentLines || 2,
        `\nThey need: ${screen.need}. Be genuinely helpful (one concrete tip or question). Do not pitch, do not link.${s.offer ? ` Context, do not quote it: we offer ${clip(s.offer, 300)}.` : ""}`);
    return { isLead: true, reason: screen.reason, need: screen.need, comment };
}

// ---------------------------------------------------------------- Outreach
export async function outreachWrite(ask: Ask, p: Record<string, any>) {
    const r = isObj(p.recipient) ? p.recipient : {};
    const ctx = isObj(p.context) ? p.context : {};
    const invite = p.kind === "invite";
    const step = Math.max(0, Number(p.stepIndex) || 0);
    const system = [
        invite
            ? "Write a LinkedIn connection request note. HARD LIMIT 280 characters. No pitch, no links."
            : `Write LinkedIn message ${step + 1} of ${Number(p.totalSteps) || 1} in a sequence to a connection. Under 90 words.${step > 0 ? " It is a follow-up: short, new angle, never guilt-trip." : ""}`,
        ctx.about && `About me: ${clip(ctx.about, 600)}`,
        ctx.offer && `What I offer (mention lightly at most): ${clip(ctx.offer, 600)}`,
        ctx.tone && `Tone: ${clip(ctx.tone, 200)}`,
        "Plain text. Use their first name. Never mention AI or that this is automated. No placeholders like [Name]."
    ].filter(Boolean).join("\n");
    const history = Array.isArray(p.history) ? p.history.slice(-6) : [];
    const user = [
        `Recipient: ${clip(r.name, 100)}, ${clip(r.headline, 200)}${r.company ? `, at ${clip(r.company, 100)}` : ""}${r.location ? `, ${clip(r.location, 80)}` : ""}.`,
        r.notes && `Notes: ${clip(r.notes, 400)}`,
        p.guidance && `Follow this guidance: ${clip(p.guidance, 800)}`,
        history.length && `Already sent:\n${history.map((h: any) => `- (${clip(h?.kind, 20)}) ${clip(h?.text, 300)}`).join("\n")}`
    ].filter(Boolean).join("\n");
    for (let i = 0; i < 2; i++) {
        let m = await write(ask, system, user, invite ? 400 : 1500);
        if (invite && m.length > 300) m = m.slice(0, 300).replace(/\s+\S*$/, "");
        if (m && !draftProblems(m, invite ? 300 : 1500).length) return { message: m };
    }
    // No "try again" here: the extension would retry (and bill) the same step; its own retry schedule handles it.
    return { error: "AI could not write a safe message for this lead" };
}

/** The store edition's operations. Anything else is "unknown operation". */
export const OPS: Record<string, (ask: Ask, body: Record<string, any>) => Promise<Record<string, any>>> = {
    "commentor.comment": commentorComment,
    "commentor.reply": commentorReply,
    "commentor.lead": commentorLead,
    "outreach.write": outreachWrite
};
