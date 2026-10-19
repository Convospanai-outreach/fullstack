import { z } from "zod";

// Per-page analytics IDs. Only IDs are accepted (no raw code), and the loaders
// below run only in the Cloudflare-served copy of a page, i.e. on a team's
// connected domain - never on the app's own /p/[slug] origin, which shares
// cookies and storage with the dashboard.

export interface LandingPageTracking {
    ga4Id?: string;
    gtmId?: string;
    hotjarId?: string;
}

export const TRACKING_ID_PATTERNS = {
    ga4Id: /^G-[A-Z0-9]{4,12}$/,
    gtmId: /^GTM-[A-Z0-9]{4,10}$/,
    hotjarId: /^\d{5,10}$/,
} as const;

function idField(pattern: RegExp) {
    return z.string().trim().toUpperCase().refine((value) => value === "" || pattern.test(value)).nullable().optional();
}

export const pageTrackingSchema = z.object({
    ga4Id: idField(TRACKING_ID_PATTERNS.ga4Id),
    gtmId: idField(TRACKING_ID_PATTERNS.gtmId),
    hotjarId: idField(TRACKING_ID_PATTERNS.hotjarId),
});

// Drops empty values; null when nothing is left.
export function normalizeTracking(value: unknown): LandingPageTracking | null {
    const parsed = pageTrackingSchema.safeParse(value ?? {});
    if (!parsed.success) return null;
    const tracking: LandingPageTracking = {};
    for (const key of ["ga4Id", "gtmId", "hotjarId"] as const) {
        const id = parsed.data[key];
        if (id) tracking[key] = id;
    }
    return Object.keys(tracking).length ? tracking : null;
}

// Vendor loaders, rewritten to create their <script> tags from code so they can
// share the page's one hashed inline script (see cloudflarePagesService.ts).
// IDs are pattern-checked and JSON-encoded before they are placed in code.
export function buildTrackingScript(value: unknown): string {
    const tracking = normalizeTracking(value);
    if (!tracking) return "";
    const parts: string[] = [];
    const load = (src: string) =>
        `var s = document.createElement("script"); s.async = true; s.src = ${src}; document.head.appendChild(s);`;

    if (tracking.gtmId) {
        parts.push(`(function () {
  window.dataLayer = window.dataLayer || [];
  window.dataLayer.push({ "gtm.start": new Date().getTime(), event: "gtm.js" });
  ${load(`"https://www.googletagmanager.com/gtm.js?id=" + ${JSON.stringify(tracking.gtmId)}`)}
})();`);
    }
    if (tracking.ga4Id) {
        parts.push(`(function () {
  window.dataLayer = window.dataLayer || [];
  window.gtag = window.gtag || function () { window.dataLayer.push(arguments); };
  window.gtag("js", new Date());
  window.gtag("config", ${JSON.stringify(tracking.ga4Id)});
  ${load(`"https://www.googletagmanager.com/gtag/js?id=" + ${JSON.stringify(tracking.ga4Id)}`)}
})();`);
    }
    if (tracking.hotjarId) {
        parts.push(`(function () {
  window.hj = window.hj || function () { (window.hj.q = window.hj.q || []).push(arguments); };
  window._hjSettings = { hjid: ${Number(tracking.hotjarId)}, hjsv: 6 };
  ${load(`"https://static.hotjar.com/c/hotjar-" + window._hjSettings.hjid + ".js?sv=" + window._hjSettings.hjsv`)}
})();`);
    }
    return `\n${parts.join("\n")}\n`;
}
