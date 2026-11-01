// Mobile checks for the editor's Mobile preview. Pure: a page's html and css in, a warning list out.
// Nothing blocks save or publish; the editor only lists the warnings.
//
// Why static (not measured in the canvas): the checks must run in unit tests without a browser and
// on every edit. They read the declared CSS and apply it to the page's elements with a simplified
// cascade (ids beat classes beat tags, later rules win ties, @media applies at 390px). Layout is not
// measured, so the results are estimates. Pseudo-classes and attribute selectors are ignored.
import { readLeadFormConfig } from "@/modules/landing-agent/leadFormHtml";

export type MobileCheckKind = "small_text" | "small_tap_target" | "heavy_images" | "no_lead_form";

export type MobileCheckWarning = { kind: MobileCheckKind; message: string };

export interface MobileCheckInput {
    html: string;
    css: string;
    // Byte sizes known at edit time, keyed by image src (only images uploaded in this editor session).
    imageBytes?: Record<string, number>;
}

export const MOBILE_TEXT_MIN_PX = 16;
export const MOBILE_TAP_MIN_PX = 44;
export const MOBILE_IMAGE_BUDGET_BYTES = 1024 * 1024;

const PHONE_WIDTH_PX = 390;
const ROOT_FONT_PX = 16;
// Browsers use about 1.2 for "normal" line height in common fonts. An estimate, not a measurement.
const NORMAL_LINE_HEIGHT = 1.2;

type Compound = { tag: string | null; ids: string[]; classes: string[] };
type Spec = [number, number, number];
type Selector = { parts: Compound[]; spec: Spec };
type Rule = { selectors: Selector[]; decls: Map<string, string> };
type Elem = { tag: string; classes: string[]; id: string | null };
type TextElem = Elem;

function stripComments(css: string): string {
    return css.replace(/\/\*[\s\S]*?\*\//g, "");
}

// Only @media queries that hold at the phone width are applied.
function mediaApplies(prelude: string): boolean {
    const max = /\(\s*max-width\s*:\s*([\d.]+)px\s*\)/i.exec(prelude);
    const min = /\(\s*min-width\s*:\s*([\d.]+)px\s*\)/i.exec(prelude);
    if (!max && !min) return false;
    if (max && PHONE_WIDTH_PX > Number(max[1])) return false;
    if (min && PHONE_WIDTH_PX < Number(min[1])) return false;
    return true;
}

function parseCompound(text: string): Compound | null {
    const match = /^([a-zA-Z][\w-]*)?((?:[.#][\w-]+)*)$/.exec(text);
    if (!match || (!match[1] && !match[2])) return null;
    const tokens = match[2].match(/[.#][\w-]+/g) ?? [];
    return {
        tag: match[1] ? match[1].toLowerCase() : null,
        ids: tokens.filter((t) => t.startsWith("#")).map((t) => t.slice(1)),
        classes: tokens.filter((t) => t.startsWith(".")).map((t) => t.slice(1)),
    };
}

// Descendant selectors only. Anything with combinators, pseudo-classes or attributes is ignored.
function parseSelector(text: string): Selector | null {
    if (!/^[\w\s.#-]+$/.test(text)) return null;
    const parts = text.split(/\s+/).filter(Boolean).map(parseCompound);
    if (parts.length === 0 || parts.some((p) => p === null)) return null;
    const compounds = parts as Compound[];
    const spec: Spec = [0, 0, 0];
    for (const c of compounds) {
        spec[0] += c.ids.length;
        spec[1] += c.classes.length;
        if (c.tag) spec[2] += 1;
    }
    return { parts: compounds, spec };
}

function parseDecls(body: string): Map<string, string> {
    const decls = new Map<string, string>();
    for (const chunk of body.split(";")) {
        const colon = chunk.indexOf(":");
        if (colon === -1) continue;
        const property = chunk.slice(0, colon).trim().toLowerCase();
        const value = chunk.slice(colon + 1).replace(/!important/i, "").trim();
        if (property && value) decls.set(property, value);
    }
    return decls;
}

function parseRules(css: string, out: Rule[] = []): Rule[] {
    let pos = 0;
    while (pos < css.length) {
        const open = css.indexOf("{", pos);
        if (open === -1) break;
        let depth = 1;
        let i = open + 1;
        while (i < css.length && depth > 0) {
            if (css[i] === "{") depth++;
            else if (css[i] === "}") depth--;
            i++;
        }
        const body = css.slice(open + 1, depth === 0 ? i - 1 : css.length);
        const prelude = css.slice(pos, open);
        pos = i;
        // Drop anything before the selector, such as an @import ending in a semicolon.
        const head = prelude.slice(prelude.lastIndexOf(";") + 1).trim();
        if (head.startsWith("@media")) {
            if (mediaApplies(head)) parseRules(body, out);
            continue;
        }
        if (head.startsWith("@")) continue;
        const selectors = head
            .split(",")
            .map((s) => parseSelector(s.trim()))
            .filter((s): s is Selector => s !== null);
        if (selectors.length > 0) out.push({ selectors, decls: parseDecls(body) });
    }
    return out;
}

function attrValue(attrs: string, name: string): string | null {
    const match = new RegExp(`(?:^|\\s)${name}\\s*=\\s*(?:"([^"]*)"|'([^']*)')`, "i").exec(attrs);
    return match ? (match[1] ?? match[2] ?? "") : null;
}

function classList(attrs: string): string[] {
    return (attrValue(attrs, "class") ?? "").split(/\s+/).filter(Boolean);
}

function elementsOf(html: string): Elem[] {
    const elems: Elem[] = [];
    for (const match of html.matchAll(/<([a-zA-Z][a-zA-Z0-9-]*)\b([^>]*)>/g)) {
        elems.push({ tag: match[1].toLowerCase(), classes: classList(match[2]), id: attrValue(match[2], "id") });
    }
    return elems;
}

// Paragraphs, list items and call-to-action links that contain text.
function textElementsOf(html: string): TextElem[] {
    const out: TextElem[] = [];
    for (const match of html.matchAll(/<(p|li|a)\b([^>]*)>([\s\S]*?)<\/\1\s*>/gi)) {
        // Text between tags counts; markup alone does not.
        if (!/(?:^|>)[^<]*[^<s]/.test(match[3])) continue;
        out.push({ tag: match[1].toLowerCase(), classes: classList(match[2]), id: attrValue(match[2], "id") });
    }
    return out;
}

function matchesCompound(elem: Elem, compound: Compound): boolean {
    if (compound.tag && compound.tag !== elem.tag) return false;
    if (compound.ids.some((id) => elem.id !== id)) return false;
    return compound.classes.every((cls) => elem.classes.includes(cls));
}

// The last part must match the element. Earlier parts must match some element on the page
// (an approximation: ancestry is not tracked).
function selectorMatches(elem: Elem, parts: Compound[], page: Elem[]): boolean {
    const last = parts[parts.length - 1];
    if (!last || !matchesCompound(elem, last)) return false;
    return parts.slice(0, -1).every((part) => page.some((other) => matchesCompound(other, part)));
}

function compareSpec(a: Spec, b: Spec): number {
    for (let i = 0; i < 3; i++) {
        if (a[i] !== b[i]) return a[i] - b[i];
    }
    return 0;
}

// The winning declared value of a property for an element, or null when no rule sets it.
function declared(elem: Elem, property: string, rules: Rule[], page: Elem[]): string | null {
    let best: { spec: Spec; value: string } | null = null;
    for (const rule of rules) {
        const value = rule.decls.get(property);
        if (value === undefined) continue;
        for (const selector of rule.selectors) {
            if (!selectorMatches(elem, selector.parts, page)) continue;
            if (!best || compareSpec(selector.spec, best.spec) >= 0) best = { spec: selector.spec, value };
        }
    }
    return best ? best.value : null;
}

// px for a length in px, rem or em (em is treated as rem: the parent size is not tracked). Null otherwise.
function lengthPx(value: string | null): number | null {
    if (value === null) return null;
    const match = /^(\d*\.?\d+)(px|rem|em)?$/.exec(value.trim());
    if (!match) return null;
    const amount = Number(match[1]);
    return match[2] === undefined || match[2] === "px" ? amount : amount * ROOT_FONT_PX;
}

function fontSizePx(elem: Elem, rules: Rule[], page: Elem[]): number | null {
    const value = declared(elem, "font-size", rules, page);
    return value === null ? ROOT_FONT_PX : lengthPx(value);
}

// Top and bottom padding in px, or null when a value is not a plain length.
function verticalPaddingPx(elem: Elem, rules: Rule[], page: Elem[]): number | null {
    const shorthand = declared(elem, "padding", rules, page);
    let sides: number[] = [0, 0, 0, 0];
    if (shorthand !== null) {
        const values = shorthand.split(/\s+/).map((v) => lengthPx(v));
        if (values.some((v) => v === null)) return null;
        const v = values as number[];
        if (v.length === 1) sides = [v[0], v[0], v[0], v[0]];
        else if (v.length === 2) sides = [v[0], v[1], v[0], v[1]];
        else if (v.length === 3) sides = [v[0], v[1], v[2], v[1]];
        else if (v.length === 4) sides = v;
        else return null;
    }
    const topValue = declared(elem, "padding-top", rules, page);
    const bottomValue = declared(elem, "padding-bottom", rules, page);
    const top = topValue === null ? sides[0] : lengthPx(topValue);
    const bottom = bottomValue === null ? sides[2] : lengthPx(bottomValue);
    if (top === null || bottom === null) return null;
    return top + bottom;
}

// Estimated rendered height of a button-style link: padding plus one line, raised by min-height,
// replaced by an explicit height. Null when the values are not plain lengths.
function tapTargetHeightPx(elem: Elem, rules: Rule[], page: Elem[]): number | null {
    const fontSize = fontSizePx(elem, rules, page);
    const padding = verticalPaddingPx(elem, rules, page);
    if (fontSize === null || padding === null) return null;
    const lineValue = declared(elem, "line-height", rules, page);
    let line = fontSize * NORMAL_LINE_HEIGHT;
    if (lineValue !== null) {
        if (/^\d*\.?\d+$/.test(lineValue.trim())) line = Number(lineValue) * fontSize;
        else line = lengthPx(lineValue) ?? line;
    }
    let height = padding + line;
    const minHeight = lengthPx(declared(elem, "min-height", rules, page));
    if (minHeight !== null) height = Math.max(height, minHeight);
    const explicit = lengthPx(declared(elem, "height", rules, page));
    if (explicit !== null) height = explicit;
    return height;
}

function imageSources(html: string): string[] {
    const srcs = new Set<string>();
    for (const match of html.matchAll(/<img\b([^>]*)>/gi)) {
        const src = attrValue(match[1], "src");
        if (src) srcs.add(src);
    }
    return [...srcs];
}

export function mobilePageWarnings(input: MobileCheckInput): MobileCheckWarning[] {
    const { html } = input;
    const rules = parseRules(stripComments(input.css));
    const page = elementsOf(html);
    const warnings: MobileCheckWarning[] = [];

    const bodyText = textElementsOf(html).filter((el) => el.tag === "p" || el.tag === "li");
    const textSizes = bodyText
        .map((el) => fontSizePx(el, rules, page))
        .filter((px): px is number => px !== null && px < MOBILE_TEXT_MIN_PX);
    if (textSizes.length > 0) {
        const count = textSizes.length;
        warnings.push({
            kind: "small_text",
            message: `${count} text block${count === 1 ? "" : "s"} under ${MOBILE_TEXT_MIN_PX}px on a phone (smallest ${Math.min(...textSizes)}px). Select the text and set Text size to ${MOBILE_TEXT_MIN_PX}px or more.`,
        });
    }

    const ctaHeights = textElementsOf(html)
        .filter((el) => el.tag === "a" && el.classes.includes("la-cta"))
        .map((el) => tapTargetHeightPx(el, rules, page))
        .filter((px): px is number => px !== null && px < MOBILE_TAP_MIN_PX);
    if (ctaHeights.length > 0) {
        const count = ctaHeights.length;
        warnings.push({
            kind: "small_tap_target",
            message: `${count} button${count === 1 ? "" : "s"} less than ${MOBILE_TAP_MIN_PX}px tall on a phone (about ${Math.round(Math.min(...ctaHeights))}px, estimated from the CSS). Phone buttons should be at least ${MOBILE_TAP_MIN_PX}px tall.`,
        });
    }

    const bytes = input.imageBytes ?? {};
    const knownTotal = imageSources(html).reduce((sum, src) => sum + (bytes[src] ?? 0), 0);
    if (knownTotal > MOBILE_IMAGE_BUDGET_BYTES) {
        warnings.push({
            kind: "heavy_images",
            message: `Images added in this editor session add up to ${(knownTotal / (1024 * 1024)).toFixed(2)} MB. The limit is 1 MB per page. Only images uploaded in this session are measured, so older images are not counted and the real total may be higher.`,
        });
    }

    if (readLeadFormConfig(html) === null) {
        warnings.push({
            kind: "no_lead_form",
            message: `No lead form block on this page, so the default "Request a follow-up" box is shown at the bottom. Add a Lead form block to choose the fields.`,
        });
    }

    return warnings;
}
