import { logger } from "@/lib/logger";

// Cloudflare for SaaS: lets a team point a domain they already own at us without
// moving DNS/nameservers to Cloudflare. We create a "custom hostname" on our own
// zone; the team adds a TXT record at their own DNS provider to prove ownership;
// once Cloudflare confirms it (and issues a certificate), traffic to their domain
// is proxied to our zone's Worker (see workers/landing-pages) with no further
// per-hostname config on our side (wildcard `*/*` Worker Route already covers it).
// Docs: https://developers.cloudflare.com/cloudflare-for-platforms/cloudflare-for-saas/

export interface CreateCustomHostnameResult {
    cloudflareHostnameId: string;
    ownershipVerification: { name: string; value: string } | null;
}

export type CustomHostnameStatus = "pending" | "active" | "invalid";

function getConfig() {
    const zoneId = process.env["CLOUDFLARE_ZONE_ID"];
    const apiToken = process.env["CLOUDFLARE_API_TOKEN"];
    if (!zoneId || !apiToken) return null;
    return { zoneId, apiToken };
}

export async function createCustomHostname(domain: string): Promise<CreateCustomHostnameResult | null> {
    const config = getConfig();
    if (!config) {
        logger.warn("[cloudflareCustomHostnameService] CLOUDFLARE_ZONE_ID/API_TOKEN not configured; skipping Cloudflare hostname creation.");
        return null;
    }

    const res = await fetch(`https://api.cloudflare.com/client/v4/zones/${config.zoneId}/custom_hostnames`, {
        method: "POST",
        headers: { Authorization: `Bearer ${config.apiToken}`, "Content-Type": "application/json" },
        body: JSON.stringify({ hostname: domain, ssl: { method: "txt", type: "dv" } }),
    });
    const json: any = await res.json().catch(() => null);
    if (!res.ok || !json?.result?.id) {
        throw new Error(json?.errors?.[0]?.message || `Cloudflare custom hostname creation failed (${res.status})`);
    }

    const ownership = json.result.ownership_verification;
    return {
        cloudflareHostnameId: json.result.id,
        ownershipVerification: ownership ? { name: ownership.name, value: ownership.value } : null,
    };
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
        { headers: { Authorization: `Bearer ${config.apiToken}` } }
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
