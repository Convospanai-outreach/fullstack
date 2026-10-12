// Cloudflare for SaaS: lets a team point a domain they already own at us without
// moving DNS/nameservers to Cloudflare. We create a "custom hostname" on our own
// zone; the team adds a CNAME at their own DNS provider pointing at our pages host;
// once Cloudflare sees it (and issues a certificate), traffic to their domain
// is proxied to our zone's Worker (see workers/landing-pages) with no further
// per-hostname config on our side (wildcard `*/*` Worker Route already covers it).
// Hostnames are created and removed from apps/web (Settings -> Branding); this
// side only polls their status.
// Docs: https://developers.cloudflare.com/cloudflare-for-platforms/cloudflare-for-saas/

export type CustomHostnameStatus = "pending" | "active" | "invalid";

// fetch has no default timeout; bound each Cloudflare API call to 10s so a stalled
// request can't hang hostname creation or the status poller (roadmap B-07).
const CLOUDFLARE_TIMEOUT_MS = 10_000;

function getConfig() {
    const zoneId = process.env["CLOUDFLARE_ZONE_ID"];
    const apiToken = process.env["CLOUDFLARE_API_TOKEN"];
    if (!zoneId || !apiToken) return null;
    return { zoneId, apiToken };
}

export async function getCustomHostnameStatus(cloudflareHostnameId: string): Promise<{
    status: CustomHostnameStatus;
    verificationErrors?: string[];
}> {
    const config = getConfig();
    if (!config) {
        return { status: "pending" };
    }

    const res = await fetch(
        `https://api.cloudflare.com/client/v4/zones/${config.zoneId}/custom_hostnames/${cloudflareHostnameId}`,
        { headers: { Authorization: `Bearer ${config.apiToken}` }, signal: AbortSignal.timeout(CLOUDFLARE_TIMEOUT_MS) }
    );
    const json: any = await res.json().catch(() => null);
    if (!res.ok || !json?.result) {
        // A transient API failure shouldn't flip a domain to "invalid" - stay pending and retry next tick.
        return { status: "pending", verificationErrors: [json?.errors?.[0]?.message || `Cloudflare lookup failed (${res.status})`] };
    }

    const hostnameStatus = json.result.status; // "pending" | "active" | ...
    const sslStatus = json.result.ssl?.status; // "pending" | "active" | ...
    const verificationErrors: string[] = json.result.verification_errors || [];

    if (hostnameStatus === "active" && sslStatus === "active") {
        return { status: "active" };
    }
    // Cloudflare's own set of terminal-failure hostname statuses.
    if (hostnameStatus === "blocked" || hostnameStatus === "duplicate" || hostnameStatus === "test_failed") {
        return { status: "invalid", verificationErrors };
    }
    return { status: "pending", verificationErrors };
}
