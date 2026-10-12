// Cloudflare for SaaS custom hostnames, the write side: creation and removal
// live here (Settings -> Branding). Status polling stays exclusively in
// apps/api's worker-manager tick (apps/web has no long-running process to run a
// poll loop in) - see apps/api/src/modules/branding/cloudflareCustomHostnameService.ts.

export interface CreateCustomHostnameResult {
    cloudflareHostnameId: string;
    ownershipVerification: { name: string; value: string } | null;
}

// Where a team points their domain's CNAME: the landing-pages Worker's own host
// (workers/landing-pages/wrangler.jsonc's DEFAULT_HOST).
export function getCnameTarget(): string {
    return process.env["LANDING_PAGES_CNAME_TARGET"] || "pages.craftmyfunnel.live";
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

    // "http" certificate validation completes on its own once the domain's CNAME
    // points at us, so the team adds one DNS record instead of three.
    const res = await fetch(`https://api.cloudflare.com/client/v4/zones/${config.zoneId}/custom_hostnames`, {
        method: "POST",
        headers: { Authorization: `Bearer ${config.apiToken}`, "Content-Type": "application/json" },
        body: JSON.stringify({ hostname: domain, ssl: { method: "http", type: "dv" } }),
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

// The landing-pages Worker's KV namespace, where it reads per-domain entries from.
function getKvConfig() {
    const config = getConfig();
    const accountId = process.env["CLOUDFLARE_ACCOUNT_ID"];
    const namespaceId = process.env["CLOUDFLARE_KV_NAMESPACE_ID"];
    if (!config || !accountId || !namespaceId) {
        throw new Error("Cloudflare is not configured (CLOUDFLARE_ZONE_ID/API_TOKEN/ACCOUNT_ID/KV_NAMESPACE_ID)");
    }
    return {
        zoneId: config.zoneId,
        headers: { Authorization: `Bearer ${config.apiToken}` },
        keyUrl: (key: string) =>
            `https://api.cloudflare.com/client/v4/accounts/${accountId}/storage/kv/namespaces/${namespaceId}/values/${encodeURIComponent(key)}`,
    };
}

async function deleteKvKey(kv: ReturnType<typeof getKvConfig>, key: string): Promise<void> {
    const res = await fetch(kv.keyUrl(key), { method: "DELETE", headers: kv.headers });
    // 404 = already gone, which is the state we want.
    if (!res.ok && res.status !== 404) {
        throw new Error(`Cloudflare KV removal of ${key} failed (${res.status})`);
    }
}

// Sets (or, with null, clears) the page the Worker serves at a connected domain's
// root: the home:<domain> -> slug KV entry.
export async function setDomainHomePage(domain: string, slug: string | null): Promise<void> {
    const kv = getKvConfig();
    if (slug === null) {
        return deleteKvKey(kv, `home:${domain}`);
    }
    const res = await fetch(kv.keyUrl(`home:${domain}`), { method: "PUT", headers: kv.headers, body: slug });
    if (!res.ok) {
        throw new Error(`Cloudflare KV home-page write failed (${res.status})`);
    }
}

// Disconnects a domain at Cloudflare: the custom hostname (so traffic stops
// reaching the Worker) and its KV entries - host:<domain> -> teamId, which the
// Worker's isolation check reads, and home:<domain> - so a later owner of the
// domain never inherits them.
export async function removeCustomHostname(domain: string, cloudflareHostnameId: string | null): Promise<void> {
    const kv = getKvConfig();
    const { headers } = kv;

    if (cloudflareHostnameId) {
        const res = await fetch(
            `https://api.cloudflare.com/client/v4/zones/${kv.zoneId}/custom_hostnames/${cloudflareHostnameId}`,
            { method: "DELETE", headers }
        );
        // 404 = already gone at Cloudflare, which is the state we want.
        if (!res.ok && res.status !== 404) {
            throw new Error(`Cloudflare custom hostname removal failed (${res.status})`);
        }
    }

    await deleteKvKey(kv, `host:${domain}`);
    await deleteKvKey(kv, `home:${domain}`);
}
