import { TELLS } from "./tellsLexicon";
import { KILL_LIST as KILL } from "./killList";

// Deterministic "AI accent" scanner for outreach and content drafts. TypeScript port of the humanizer
// skill's scanner (lexicon in tellsLexicon.ts) plus the copywriting kill-list of empty marketing words.
// It scores, it does not rewrite: callers show the hits, feed them to the critic, or block on a band.
// Rhythm measures from the original (sentence-length variance etc.) are left out: outreach drafts are
// too short for them to mean much. Tune severities and words in tellsLexicon.ts / killList.ts, not here.

export type TellCategory = "words" | "phrases" | "openers_closers" | "structures" | "punctuation" | "marketing";
export interface TellHit { category: TellCategory; label: string; match: string; start: number; end: number; severity: 1 | 2 | 3; fix: string }
export interface TellScan { score: number; band: string; words: number; hits: TellHit[] }

type Entry = { w?: string[]; p?: string[]; re?: string; id?: string; label?: string; sev?: number; fix?: string; skip?: string; initial?: boolean; comma?: boolean; where?: string; cs?: boolean; raw?: boolean; min?: number; free?: number; max_words?: number; pts_per100?: number; free_per100?: number };
type Lexicon = { scoring: { sev_points: Record<string, number>; category_mult: Record<string, number>; floor_words: number; scale: number; bands: [string, number][] }; words: Entry[]; phrases: Entry[]; openers_closers: Entry[]; structures: Entry[]; punctuation: Entry[] };
type KillList = { words: { forms: string[]; fix: string }[]; phrases?: { forms: string[]; fix: string }[]; ai_tell_phrases?: string[] };

const LEX = TELLS as unknown as Lexicon;
const KILLS = KILL as unknown as KillList;
const PRIORITY: Record<TellCategory, number> = { structures: 5, openers_closers: 4, phrases: 3, marketing: 2, words: 1, punctuation: 0 };

const esc = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
// Python named groups to JS, and compile once.
// \U0001F300 (Python) becomes \u{1F300} and needs the u flag.
const pyToJs = (re: string) => re.replace(/\(\?P</g, "(?<").replace(/\\U([0-9A-Fa-f]{8})/g, (_, h: string) => `\\u{${h.replace(/^0+/, "")}}`);
const compile = (re: string, flags: string) => {
    const js = pyToJs(re);
    try { return new RegExp(js, js.includes("\\u{") ? `${flags}u` : flags); } catch { return null; }
};
const phraseRx = (p: string) => new RegExp(`(?<![a-z0-9'])${p.split(/\s+/).map(esc).join("\\s+")}${/[a-z0-9]$/.test(p) ? "(?![a-z0-9])" : ""}`, "g");

const WORD_MAP = new Map<string, Entry & { skipRx: RegExp | null }>();
for (const e of LEX.words) for (const w of e.w ?? []) WORD_MAP.set(w.toLowerCase(), { ...e, skipRx: e.skip ? compile(e.skip, "") : null });
const MARKETING = new Map<string, string>();
for (const k of KILLS.words ?? []) for (const f of k.forms) if (!f.includes(" ")) MARKETING.set(f.toLowerCase(), k.fix);
const PHRASES: { cat: TellCategory; e: Entry; rx: RegExp }[] = [];
for (const [cat, list] of [["phrases", LEX.phrases], ["openers_closers", LEX.openers_closers]] as const) for (const e of list) for (const p of e.p ?? []) PHRASES.push({ cat, e, rx: phraseRx(p.toLowerCase()) });
const killPhrases = [
    ...(KILLS.words ?? []).flatMap((x) => x.forms.filter((f) => f.includes(" ")).map((f) => ({ f, fix: x.fix }))),
    ...(KILLS.phrases ?? []).flatMap((x) => x.forms.map((f) => ({ f, fix: x.fix }))),
    ...(KILLS.ai_tell_phrases ?? []).map((f) => ({ f, fix: "say the thing plainly" })),
];
for (const k of killPhrases) PHRASES.push({ cat: "marketing", e: { sev: 2, fix: k.fix, label: k.f }, rx: phraseRx(k.f.toLowerCase()) });
const STRUCTS = LEX.structures.map((e) => ({ e, rx: compile(e.re ?? "", "gm") })).filter((s): s is { e: Entry; rx: RegExp } => s.rx !== null);
const PUNCT = LEX.punctuation.map((e) => ({ e, rx: compile(e.re ?? "", "g") })).filter((s): s is { e: Entry; rx: RegExp } => s.rx !== null);

// Links and addresses are blanked (same length, so offsets hold) so "https://x.com/leverage" is not a hit.
function mask(text: string) {
    return text.replace(/https?:\/\/\S+|www\.\S+|[^\s@]+@[^\s@]+\.[^\s@]+|\{\{[^}]*\}\}|\[[A-Z_]+\]/g, (m) => " ".repeat(m.length));
}
function atSentenceStart(text: string, pos: number) {
    const before = text.slice(Math.max(0, pos - 4), pos);
    return pos === 0 || /(^|[.!?\n]\s*)$/.test(before) || /\n\s*$/.test(before);
}
function resolve(hits: TellHit[]) {
    hits.sort((a, b) => a.start - b.start || (b.end - b.start) - (a.end - a.start));
    const out: TellHit[] = [];
    for (const h of hits) {
        const prev = out[out.length - 1];
        if (prev && h.start < prev.end) {
            if ([PRIORITY[h.category], h.severity, h.end - h.start] > [PRIORITY[prev.category], prev.severity, prev.end - prev.start] && (PRIORITY[h.category] > PRIORITY[prev.category] || (PRIORITY[h.category] === PRIORITY[prev.category] && h.severity > prev.severity))) out[out.length - 1] = h;
            continue;
        }
        out.push(h);
    }
    return out;
}
const sev = (n: number | undefined): 1 | 2 | 3 => (n === 1 || n === 3 ? n : 2);

export function scanAiTells(input: string): TellScan {
    const raw = input ?? "";
    const masked = mask(raw);
    const low = masked.toLowerCase();
    const words = (low.match(/[a-z0-9][a-z0-9'-]*/g) ?? []).length;
    const { scoring } = LEX;
    if (words === 0) return { score: 0, band: scoring.bands[0]![0], words: 0, hits: [] };

    const tier: TellHit[] = [];
    for (const m of low.matchAll(/[a-z][a-z'-]*/g)) {
        const tok = m[0].replace(/'s$/, "");
        const s = m.index!, e = s + m[0].length;
        const ent = WORD_MAP.get(tok);
        if (ent) {
            const ok = (!ent.initial || atSentenceStart(masked, s)) && (!ent.comma || /^\s*,/.test(low.slice(e, e + 8))) && !(ent.skipRx && ent.skipRx.test(low.slice(Math.max(0, s - 40), e + 40)));
            if (ok) tier.push({ category: "words", label: tok, match: raw.slice(s, e), start: s, end: e, severity: sev(ent.sev), fix: ent.fix ?? "" });
        } else if (MARKETING.has(tok)) {
            tier.push({ category: "marketing", label: tok, match: raw.slice(s, e), start: s, end: e, severity: 2, fix: MARKETING.get(tok)! });
        }
    }
    for (const { cat, e, rx } of PHRASES) {
        rx.lastIndex = 0;
        for (const m of low.matchAll(rx)) {
            const s = m.index!, end = s + m[0].length;
            if (e.initial && !atSentenceStart(masked, s)) continue;
            if (e.where === "start") { const para = low.lastIndexOf("\n\n", s); if (s - (para < 0 ? 0 : para + 2) > 90) continue; }
            if (e.where === "end" && end < raw.trimEnd().length - 300) continue;
            tier.push({ category: cat, label: e.label ?? m[0].replace(/\s+/g, " "), match: raw.slice(s, end), start: s, end, severity: sev(e.sev), fix: e.fix ?? "" });
        }
    }
    const hits = resolve(tier);
    const structHits: TellHit[] = [];
    for (const { e, rx } of STRUCTS) {
        if (e.max_words && words > e.max_words) continue;
        const src = e.raw ? raw : e.cs ? masked : low;
        rx.lastIndex = 0;
        const found = [...src.matchAll(rx)].map((m) => {
            const hit = m.groups?.["hit"];
            const s = hit !== undefined ? m.index! + m[0].indexOf(hit) : m.index!;
            return [s, s + (hit ?? m[0]).length] as const;
        });
        if (found.length < (e.min ?? 1)) continue;
        for (const [s, end] of found.slice(e.free ?? 0)) structHits.push({ category: "structures", label: e.label ?? (e.id ?? "").replace(/_/g, " "), match: raw.slice(s, end), start: s, end, severity: sev(e.sev), fix: e.fix ?? "" });
    }
    hits.push(...resolve(structHits));

    const denom = Math.max(words, scoring.floor_words);
    const per = 100 / denom;
    let total = 0;
    for (const h of hits) total += (scoring.sev_points[String(h.severity)] ?? 1) * (scoring.category_mult[h.category === "marketing" ? "words" : h.category] ?? 1) * per;
    for (const { e, rx } of PUNCT) {
        rx.lastIndex = 0;
        const ms = [...(e.raw ? raw : masked).matchAll(rx)];
        const allowed = e.id === "em_dash" ? 0 : Math.max(1, ((e.free_per100 ?? 0) * denom) / 100);
        total += (e.pts_per100 ?? 1) * Math.max(0, ms.length - allowed) * per;
        if (e.id === "em_dash" || ms.length > allowed) for (const m of ms) hits.push({ category: "punctuation", label: e.label ?? e.id ?? "punctuation", match: m[0], start: m.index!, end: m.index! + m[0].length, severity: e.id === "em_dash" ? 3 : 2, fix: e.fix ?? "" });
    }
    const score = total > 0 ? Math.round(100 * (1 - Math.exp(-total / scoring.scale))) : 0;
    const band = scoring.bands.find(([, top]) => score <= top)?.[0] ?? scoring.bands[scoring.bands.length - 1]![0];
    hits.sort((a, b) => a.start - b.start);
    return { score, band, words, hits };
}

/** Short list for a critic prompt: the worst distinct hits with their fix. Empty string when clean. */
export function aiTellsForCritic(text: string, limit = 8): string {
    const { hits, score, band } = scanAiTells(text);
    if (hits.length === 0) return "";
    const seen = new Set<string>();
    const lines = [...hits].sort((a, b) => b.severity - a.severity).filter((h) => (seen.has(h.label) ? false : (seen.add(h.label), true))).slice(0, limit)
        .map((h) => `- "${h.match.trim()}" (${h.label}): ${h.fix}`);
    return `AI-sounding phrasing found (score ${score}/100, ${band}). Rewrite these:\n${lines.join("\n")}`;
}

/** Mechanical fix for the loudest tell: em dashes become commas or full stops. Leaves everything else. */
export function stripEmDashes(text: string): string {
    return text
        .replace(/\s*[—―]\s*(?=[A-Z])/g, ". ")
        .replace(/\s*[—―]\s*/g, ", ")
        .replace(/,\s*([.,!?;:])/g, "$1")
        .replace(/ {2,}/g, " ");
}
