import { domainToASCII } from "node:url";

// Reads every link out of a piece of outbound text, including links written to dodge a plain
// "https?://" scan. A host is returned lowercase, without "www.", and in punycode. A link that
// cannot be read comes back as null, and callers must treat null as foreign.

const INVISIBLE = /[​-‏⁠﻿­]/g;
const EMAIL = /[\p{L}\p{N}._%+-]+@[\p{L}\p{N}-]+(?:\.[\p{L}\p{N}-]+)+/gu;
const HREF = /href\s*=\s*(?:"([^"]*)"|'([^']*)')/gi;
const SCHEME_URL = /\b[a-z][a-z0-9+.-]*:\/\/[^\s<>"'\])]*/gi;
const TOKEN = /[\p{L}\p{N}](?:[\p{L}\p{N}.-]*[\p{L}\p{N}])?/gu;
const IPV4 = /^\d{1,3}(?:\.\d{1,3}){3}$/;

/** Lowercase host without scheme, path, port, "www." or a trailing dot; "" when it is not a host. */
export function normalizeHost(value: string): string {
    const bare = value
        .trim()
        .toLowerCase()
        .replace(/^[a-z][a-z0-9+.-]*:\/\//, "")
        .replace(/[/?#].*$/, "")
        .replace(/:\d+$/, "")
        .replace(/\.+$/, "")
        .replace(/^www\./, "");
    return bare ? domainToASCII(bare) : "";
}

function hostOfUrl(raw: string): string | null {
    try {
        const host = new URL(raw).hostname;
        return host ? normalizeHost(host) || null : null;
    } catch {
        return null;
    }
}

function hostOfToken(token: string): string | null | undefined {
    if (!token.includes(".")) return undefined;
    const labels = token.split(".");
    if (labels.some((l) => !l)) return undefined;
    const isIp = IPV4.test(token) && labels.every((l) => Number(l) <= 255);
    if (!isIp && !/^(?:[\p{L}]{2,24}|xn--[a-z0-9-]+)$/iu.test(labels[labels.length - 1])) return undefined;
    return normalizeHost(token) || null;
}

function deobfuscate(text: string): string {
    return text
        .replace(/\s*[[({]\s*(?:dot|\.)\s*[\])}]\s*/gi, ".")
        .replace(/(\S)\s+dot\s+(\S)/gi, "$1.$2")
        .replace(/(\S)\s+\.\s+(\S)/g, "$1.$2");
}

export function linkHostsIn(input: string): (string | null)[] {
    const hosts: (string | null)[] = [];
    let text = input.replace(INVISIBLE, "");

    text = text.replace(HREF, (_m, dq: string | undefined, sq: string | undefined) => {
        const value = (dq ?? sq ?? "").trim();
        if (/^mailto:/i.test(value)) return " ";
        if (/^[a-z][a-z0-9+.-]*:/i.test(value) && !/^https?:/i.test(value)) {
            hosts.push(null);
            return " ";
        }
        hosts.push(/^https?:\/\//i.test(value) ? hostOfUrl(value) : hostOfUrl(`http://${normalizeBare(value)}`));
        return " ";
    });

    text = text.replace(SCHEME_URL, (raw) => {
        hosts.push(hostOfUrl(raw));
        return " ";
    });

    text = deobfuscate(text.replace(EMAIL, " "));
    for (const token of text.match(TOKEN) ?? []) {
        const host = hostOfToken(token);
        if (host !== undefined) hosts.push(host);
    }
    return hosts;
}

function normalizeBare(value: string): string {
    return deobfuscate(value.replace(INVISIBLE, "")).replace(/\s+/g, "");
}

/** True when `host` is one of the allowed hosts or a subdomain of one. An unreadable link never passes. */
export function hostAllowed(host: string | null, allowed: string[]): boolean {
    if (!host) return false;
    return allowed.map(normalizeHost).some((a) => a && (host === a || host.endsWith(`.${a}`)));
}
