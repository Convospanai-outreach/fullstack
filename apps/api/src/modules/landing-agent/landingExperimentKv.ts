// Writes an experiment's routing into the Worker's KV (workers/landing-pages), one key per connected domain:
// exp:<domain>:<slug> -> { experimentId, teamId, mode, ... }. Same rule as page publish: a no-op when Cloudflare
// is not configured, and errors are logged, never thrown into the action that triggered the write.
import { prisma } from "@/lib/db";
import { logger } from "@/lib/logger";

export interface ExperimentKvEntry {
    experimentId: string;
    teamId: string;
    // "test": the Worker splits visitors by weightA with a sticky cookie. "fixed": every visitor gets fixedVariant.
    mode: "test" | "fixed";
    weightA?: number;
    fixedVariant?: "A" | "B";
    arms: { A: string; B: string };
}

// draft: nothing is routed yet. running: the test. paused: everyone gets A. ended: the winner, or A if none was picked.
export function kvEntryFor(experiment: {
    id: string;
    teamId: string;
    status: string;
    winnerPageId: string | null;
    variants: Array<{ name: string; landingPageId: string; weight: number; landingPage: { slug: string } }>;
}): ExperimentKvEntry | null {
    const a = experiment.variants.find((v) => v.name === "A");
    const b = experiment.variants.find((v) => v.name === "B");
    if (!a || !b || experiment.status === "draft") return null;
    const arms = { A: a.landingPage.slug, B: b.landingPage.slug };
    const base = { experimentId: experiment.id, teamId: experiment.teamId, arms };
    if (experiment.status === "running") {
        return { ...base, mode: "test", weightA: a.weight };
    }
    const winner = experiment.winnerPageId === b.landingPageId ? "B" : "A";
    return { ...base, mode: "fixed", fixedVariant: experiment.status === "paused" ? "A" : winner };
}

function getCloudflareConfig() {
    const accountId = process.env["CLOUDFLARE_ACCOUNT_ID"];
    const apiToken = process.env["CLOUDFLARE_API_TOKEN"];
    const namespaceId = process.env["CLOUDFLARE_KV_NAMESPACE_ID"];
    if (!accountId || !apiToken || !namespaceId) return null;
    return { accountId, apiToken, namespaceId };
}

export async function writeExperimentToKv(experimentId: string): Promise<{ status: "pushed" | "skipped" | "error"; details?: string }> {
    const config = getCloudflareConfig();
    if (!config) {
        return { status: "skipped", details: "Cloudflare is not configured" };
    }
    try {
        const experiment = await prisma.landingExperiment.findUnique({
            where: { id: experimentId },
            include: { variants: { include: { landingPage: { select: { slug: true } } } } },
        });
        if (!experiment) {
            return { status: "error", details: "Experiment not found" };
        }
        const entry = kvEntryFor(experiment);
        if (!entry) {
            return { status: "skipped", details: "Draft tests are not routed" };
        }
        // Routed on every active connected domain the team has, like page publish.
        const domains = await prisma.customDomain.findMany({
            where: { teamId: experiment.teamId, status: "active" },
            select: { domain: true },
        });
        for (const { domain } of domains) {
            const key = `exp:${domain}:${experiment.slug}`;
            const res = await fetch(
                `https://api.cloudflare.com/client/v4/accounts/${config.accountId}/storage/kv/namespaces/${config.namespaceId}/values/${encodeURIComponent(key)}`,
                {
                    method: "PUT",
                    headers: { Authorization: `Bearer ${config.apiToken}`, "Content-Type": "application/json" },
                    body: JSON.stringify(entry),
                },
            );
            if (!res.ok) {
                throw new Error(`Cloudflare KV write failed: ${res.status} ${await res.text()}`);
            }
        }
        return { status: "pushed" };
    } catch (error) {
        const message = error instanceof Error ? error.message : "Unknown error";
        logger.error(`[landingExperimentKv] write failed for experiment ${experimentId}:`, { error: message });
        return { status: "error", details: message };
    }
}
