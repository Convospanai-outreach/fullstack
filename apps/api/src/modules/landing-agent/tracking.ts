import { z } from "zod";

// Per-page analytics IDs. Only IDs are accepted (no raw code), and the loaders
// below run only in the Cloudflare-served copy of a page, i.e. on a team's
// connected domain - never on the app's own /p/[slug] origin, which shares
// cookies and storage with the dashboard.

export interface LandingPageTracking {
    ga4Id?: string;
    gtmId?: string;
    hotjarId?: string;
    metaPixelId?: string;
    // Meta's "Test events" code. Sent only with server-side (Conversions API) events, and only when set.
    metaTestEventCode?: string;
}

export const TRACKING_ID_PATTERNS = {
    ga4Id: /^G-[A-Z0-9]{4,12}$/,
    gtmId: /^GTM-[A-Z0-9]{4,10}$/,
    hotjarId: /^\d{5,10}$/,
    metaPixelId: /^\d{5,20}$/,
} as const;

const META_TEST_EVENT_CODE_PATTERN = /^[A-Za-z0-9_-]{1,40}$/;

function idField(pattern: RegExp) {
    return z.string().trim().toUpperCase().refine((value) => value === "" || pattern.test(value)).nullable().optional();
}

export const pageTrackingSchema = z.object({
    ga4Id: idField(TRACKING_ID_PATTERNS.ga4Id),
    gtmId: idField(TRACKING_ID_PATTERNS.gtmId),
    hotjarId: idField(TRACKING_ID_PATTERNS.hotjarId),
    metaPixelId: idField(TRACKING_ID_PATTERNS.metaPixelId),
    metaTestEventCode: z
        .string()
        .trim()
        .refine((value) => value === "" || META_TEST_EVENT_CODE_PATTERN.test(value))
        .nullable()
        .optional(),
});

// Drops empty values; null when nothing is left.
export function normalizeTracking(value: unknown): LandingPageTracking | null {
    const parsed = pageTrackingSchema.safeParse(value ?? {});
    if (!parsed.success) return null;
    const tracking: LandingPageTracking = {};
    for (const key of ["ga4Id", "gtmId", "hotjarId", "metaPixelId", "metaTestEventCode"] as const) {
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
    if (tracking.metaPixelId) {
        // Meta Pixel (fbevents.js). Visitors who send Do Not Track or Global Privacy Control get no Pixel,
        // and no event IDs either, so the lead form does not report them to the server (see cloudflarePagesService.ts).
        // cmfMeta.newId() makes the event ID that the browser Pixel and the server event share.
        parts.push(`(function () {
  var off = navigator.doNotTrack === "1" || navigator.globalPrivacyControl === true;
  window.cmfMeta = {
    newId: function () {
      if (off) return null;
      return crypto.randomUUID ? crypto.randomUUID() : "evt-" + Date.now() + "-" + Math.random().toString(36).slice(2);
    },
    track: function (name, eventId) {
      if (!off && eventId && window.fbq) window.fbq("track", name, {}, { eventID: eventId });
    },
  };
  if (off) return;
  var n = window.fbq = function () { n.callMethod ? n.callMethod.apply(n, arguments) : n.queue.push(arguments); };
  if (!window._fbq) window._fbq = n;
  n.push = n; n.loaded = true; n.version = "2.0"; n.queue = [];
  ${load(`"https://connect.facebook.net/en_US/fbevents.js"`)}
  window.fbq("init", ${JSON.stringify(tracking.metaPixelId)});
  window.fbq("track", "PageView", {}, { eventID: window.cmfMeta.newId() });
})();`);
    }
    return `\n${parts.join("\n")}\n`;
}
