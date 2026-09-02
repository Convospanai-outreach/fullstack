// Mirrors apps/api/src/modules/branding/cloudflareCustomHostnameService.ts's
// createCustomHostname (duplicated per this repo's established precedent of
// duplication over cross-app coupling - apps/web and apps/api are separate
// deployments). Only hostname creation lives here; status polling stays
// exclusively in apps/api's worker-manager tick (apps/web has no long-running
// process to run a poll loop in).

export interface CreateCustomHostnameResult {
    cloudflareHostnameId: string;
    ownershipVerification: { name: string; value: string } | null;
}

function getConfig() {
    const zoneId = process.env["CLOUDFLARE_ZONE_ID"];
    const apiToken = process.env["CLOUDFLARE_API_TOKEN"];
    if (!zoneId || !apiToken) return null;
    return { zoneId, apiToken };
}

export async function createCustomHostname(domain: string): Promise<CreateCustomHostnameResult | null> {
    const config = getConfig();
    if (!config) return null;

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
