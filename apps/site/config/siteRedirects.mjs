// Redirect rules written in the CMS (content/settings/redirects.json), read by next.config.mjs.
// Kept as plain JavaScript so the config file can import it. A rule that could break the site or send
// visitors somewhere unsafe is skipped, and a missing or broken file gives no rules, never a failed build.
import fs from 'fs';
import path from 'path';

const MAX_RULES = 500;
// Plain paths only: no query, fragment, or pattern characters (:, *, parentheses) in a source.
const SOURCE = /^\/[A-Za-z0-9._~\-/%]*$/;
const PROTECTED_PREFIXES = ['/api', '/_next', '/cms', '/superadmin'];

const isProtected = (source) => PROTECTED_PREFIXES.some((prefix) => source === prefix || source.startsWith(`${prefix}/`));

function validDestination(to) {
    if (typeof to !== 'string' || /[\s\\]/.test(to)) return false;
    if (to.startsWith('/')) return !to.startsWith('//');
    try {
        return new URL(to).protocol === 'https:';
    } catch {
        return false;
    }
}

export function loadSiteRedirects(file = path.join(process.cwd(), 'content/settings/redirects.json')) {
    let parsed;
    try {
        parsed = JSON.parse(fs.readFileSync(file, 'utf8'));
    } catch {
        return [];
    }
    const rules = parsed && Array.isArray(parsed.redirects) ? parsed.redirects : [];

    const seen = new Set();
    const result = [];
    for (const rule of rules) {
        if (result.length >= MAX_RULES) break;
        const from = rule && typeof rule.from === 'string' ? rule.from.trim() : '';
        const to = rule && typeof rule.to === 'string' ? rule.to.trim() : '';
        if (!SOURCE.test(from) || from === '/' || isProtected(from) || seen.has(from)) continue;
        if (!validDestination(to) || to === from) continue;
        seen.add(from);
        result.push({ from, to, permanent: rule.permanent === true });
    }
    return result;
}

export const toNextRedirects = (rules) => rules.map(({ from, to, permanent }) => ({ source: from, destination: to, permanent }));
