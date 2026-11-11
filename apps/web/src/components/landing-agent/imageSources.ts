// Pure image-source rules for the landing editor. No DOM, no network: the server
// never fetches a user-supplied URL, it only decides how the editor labels one.

export type ImageSourceKind = "own" | "external" | "rejected";

export const LANDING_IMAGES_OBJECT_PATH = "/storage/v1/object/public/landing-images/";
export const OWN_ASSET_PATH = "/landing-assets/";

// Public URL prefix of the landing-images bucket for a Supabase project URL, or
// null when the project URL is not set or not a valid URL.
export function landingImagesPrefix(supabaseUrl: string | undefined): string | null {
    if (!supabaseUrl) return null;
    try {
        return `${new URL(supabaseUrl).origin}${LANDING_IMAGES_OBJECT_PATH}`;
    } catch {
        return null;
    }
}

// "own": our bucket or our built-in /landing-assets/ files.
// "external": any other https URL (allowed, shown with a note; never fetched by us).
// "rejected": anything else (http, data:, javascript:, blob:, protocol-relative,
// URLs with credentials, traversal out of /landing-assets/).
export function classifyImageSource(rawUrl: string, ownLandingImagesPrefix: string | null = null): ImageSourceKind {
    const value = rawUrl.trim();
    if (!value || value.includes("\\")) return "rejected";

    if (value.startsWith("/")) {
        if (value.startsWith("//")) return "rejected";
        if (!value.startsWith(OWN_ASSET_PATH)) return "rejected";
        const path = value.split(/[?#]/)[0] ?? value;
        return path.split("/").includes("..") ? "rejected" : "own";
    }

    let url: URL;
    try {
        url = new URL(value);
    } catch {
        return "rejected";
    }
    if (url.protocol !== "https:") return "rejected";
    if (url.username || url.password) return "rejected";

    if (ownLandingImagesPrefix && `${url.origin}${url.pathname}`.startsWith(ownLandingImagesPrefix)) {
        return "own";
    }
    return "external";
}

export type ImageAltWarning = { src: string | null; problem: "missing" | "empty" };

// Lists <img> tags whose alt attribute is missing or blank. Regex-based on purpose:
// the editor only needs to warn, and the saved HTML is re-sanitized on the server.
export function imageAltWarnings(html: string): ImageAltWarning[] {
    const warnings: ImageAltWarning[] = [];
    for (const [tag] of html.matchAll(/<img\b[^>]*>/gi)) {
        const src = /\ssrc\s*=\s*("([^"]*)"|'([^']*)'|([^\s>]+))/i.exec(tag);
        const srcValue = src ? (src[2] ?? src[3] ?? src[4] ?? null) : null;
        const alt = /\salt\s*=\s*("([^"]*)"|'([^']*)'|([^\s>]+))/i.exec(tag);
        if (!alt) {
            warnings.push({ src: srcValue, problem: "missing" });
            continue;
        }
        const altValue = alt[2] ?? alt[3] ?? alt[4] ?? "";
        if (!altValue.trim()) warnings.push({ src: srcValue, problem: "empty" });
    }
    return warnings;
}

// Message for the editor's paste-a-URL field: an error for rejected sources, a note for external ones.
export function imageSourceMessage(url: string): { error: string | null; note: string | null } {
    if (!url.trim()) return { error: null, note: null };
    const kind = classifyImageSource(url);
    if (kind === "rejected") {
        return { error: "Use a direct https:// image address. This link cannot be used.", note: null };
    }
    if (kind === "external") {
        return { error: null, note: "External image: it loads from its own server. We do not host or check it." };
    }
    return { error: null, note: "Built-in or landing image." };
}
