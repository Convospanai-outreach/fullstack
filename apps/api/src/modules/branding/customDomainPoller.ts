import { prisma } from "@/lib/db";
import { logger } from "@/lib/logger";
import { getCustomHostnameStatus } from "./cloudflareCustomHostnameService";

// Once a CustomDomain goes "active", the landing-pages Worker needs to know which
// team owns that hostname (see workers/landing-pages/src/index.ts's isolation
// check) - written into the same KV namespace cloudflarePagesService.ts pushes
// page content into, under a "host:" prefix so the two key spaces never collide.
async function writeHostOwnership(domain: string, teamId: string): Promise<void> {
    const accountId = process.env["CLOUDFLARE_ACCOUNT_ID"];
    const apiToken = process.env["CLOUDFLARE_API_TOKEN"];
    const namespaceId = process.env["CLOUDFLARE_KV_NAMESPACE_ID"];
    if (!accountId || !apiToken || !namespaceId) return;

    const res = await fetch(
        `https://api.cloudflare.com/client/v4/accounts/${accountId}/storage/kv/namespaces/${namespaceId}/values/host:${encodeURIComponent(domain)}`,
        { method: "PUT", headers: { Authorization: `Bearer ${apiToken}` }, body: teamId }
    );
    if (!res.ok) {
        throw new Error(`Cloudflare KV host-ownership write failed: ${res.status} ${await res.text()}`);
    }
}

/** Advances every pending CustomDomain against Cloudflare's verification status. */
export async function pollPendingCustomDomains(limit = 25) {
    const pending = await prisma.customDomain.findMany({
        where: { status: "pending", cloudflareHostnameId: { not: null } },
        take: limit,
    });

    const results: Array<{ domain: string; status: string }> = [];

    for (const record of pending) {
        try {
            const { status } = await getCustomHostnameStatus(record.cloudflareHostnameId!);
            if (status === "active") {
                await writeHostOwnership(record.domain, record.teamId);
            }
            if (status !== "pending") {
                await prisma.customDomain.update({
                    where: { id: record.id },
                    data: { status, lastCheckedAt: new Date() },
                });
                results.push({ domain: record.domain, status });
            } else {
                await prisma.customDomain.update({ where: { id: record.id }, data: { lastCheckedAt: new Date() } });
            }
        } catch (error) {
            const message = error instanceof Error ? error.message : "Unknown error";
            logger.error(`[customDomainPoller] Failed checking domain ${record.domain}:`, { error: message });
        }
    }

    return results;
}
