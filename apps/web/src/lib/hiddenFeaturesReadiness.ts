import { getEdgeRuntimeAvailability } from "@/lib/edgeRuntime";
import {
    getDefaultEnabledHiddenFeatureKeys,
    HiddenFeatureKey,
    HIDDEN_FEATURES,
    mergeEnabledHiddenFeatureKeys,
    parseEnabledHiddenFeatureKeys,
} from "@/lib/productFlags";

export type ReadinessState = {
    ready: boolean;
    reason: string;
    action: string;
};

export async function loadFeatureContext(teamId: string) {
    const { prisma } = await import("@/lib/db");
    const [team, callerCount, agentTaskCount, marketplaceTemplateCount, policy, edgeAvailability] = await Promise.all([
        prisma.team.findUnique({
            where: { id: teamId },
            select: {
                aiConfig: true,
                enabledFeatures: true,
                _count: {
                    select: {
                        campaigns: true,
                        jobs: true,
                        knowledgeBases: true,
                        leads: true,
                        playbooks: true,
                        scrapingJobs: true,
                        workflows: true,
                    },
                },
            },
        }),
        prisma.user.count({
            where: {
                callerTeamId: teamId,
                isCaller: true,
            },
        }),
        prisma.agentTask.count({
            where: { teamId },
        }),
        prisma.marketplaceTemplate.count(),
        prisma.organizationPolicy.findUnique({
            where: { organizationId: teamId },
            select: {
                productSurface: true,
                allowScraping: true,
            },
        }),
        getEdgeRuntimeAvailability(),
    ]);

    if (!team) {
        throw new Error("Team not found");
    }

    const aiConfig = (team.aiConfig as Record<string, any> | null) || {};
    const providerConfig = (aiConfig["providers"] as Record<string, any> | undefined) || {};
    const hasAiProvider = Boolean(
        process.env["GEMINI_API_KEY"] ||
        process.env["OPENAI_API_KEY"] ||
        process.env["ANTHROPIC_API_KEY"] ||
        aiConfig["apiKey"] ||
        providerConfig["gemini"]?.apiKey ||
        providerConfig["openai"]?.apiKey ||
        providerConfig["anthropic"]?.apiKey
    );
    const hasLinkedInRuntime = Boolean(
        process.env["EXTENSION_API_KEY"] ||
        process.env["BROWSER_NODE_URL"] ||
        process.env["BROWSER_WS_ENDPOINT"]
    );
    const hasHunter = Boolean(process.env["HUNTER_API_KEY"] || process.env["HUNTER_IO_API_KEY"]);
    const hasScraperSecret = Boolean(process.env["SCRAPER_SECRET"]);
    const strictSovereignty = process.env["STRICT_SOVEREIGNTY"]?.trim().toLowerCase() === "true";

    return {
        agentTaskCount,
        callerCount,
        edgeAvailability,
        hasAiProvider,
        hasHunter,
        hasLinkedInRuntime,
        hasScraperSecret,
        marketplaceTemplateCount,
        policy,
        strictSovereignty,
        team,
    };
}

export function resolveReadiness(featureKey: HiddenFeatureKey, context: Awaited<ReturnType<typeof loadFeatureContext>>): ReadinessState {
    const counts = context.team._count;

    switch (featureKey) {
        case "agents":
            return context.hasAiProvider
                ? {
                    ready: true,
                    reason: counts.leads > 0 || counts.campaigns > 0
                        ? "AI providers are configured and the team already has live outreach data."
                        : "AI providers are configured. This can be enabled before leads and campaigns are added.",
                    action: "Turn this on when you want to expose the agent workspace.",
                }
                : {
                    ready: false,
                    reason: "No AI provider is configured for this workspace yet.",
                    action: "Add Gemini, OpenAI, or Anthropic credentials first.",
                };
        case "caller":
            return context.callerCount > 0
                ? {
                    ready: true,
                    reason: `${context.callerCount} caller account(s) are assigned to this team.`,
                    action: "Turn this on when the caller workspace is ready to use.",
                }
                : {
                    ready: false,
                    reason: "No caller accounts are assigned to this team yet.",
                    action: "Assign at least one caller user before exposing this area.",
                };
        case "command-center":
            return counts.campaigns > 0 || counts.jobs > 0
                ? {
                    ready: true,
                    reason: "This team already has campaign or job activity to supervise.",
                    action: "Turn this on when operators need the command center.",
                }
                : {
                    ready: false,
                    reason: "There are no campaigns or jobs yet, so the command center would be mostly empty.",
                    action: "Create a campaign or run jobs first.",
                };
        case "csv-ingestion":
            return {
                ready: true,
                reason: "CSV ingestion does not need extra runtime data before exposure.",
                action: "Turn this on whenever bulk import should be available.",
            };
        case "edge":
            return context.edgeAvailability.configured
                ? {
                    ready: true,
                    reason: context.edgeAvailability.message,
                    action: "Turn this on when you want to expose edge controls.",
                }
                : {
                    ready: false,
                    reason: "No edge runtime endpoint is configured.",
                    action: "Configure EDGE_NODE_URL or EDGE_NODE_URI first.",
                };
        case "hunter-email-finder":
            return context.hasHunter
                ? {
                    ready: true,
                    reason: "Hunter credentials are configured.",
                    action: "Turn this on when email finding should be visible in the app.",
                }
                : {
                    ready: false,
                    reason: "Hunter credentials are not configured.",
                    action: "Add HUNTER_API_KEY or HUNTER_IO_API_KEY first.",
                };
        case "jobs":
            return counts.jobs > 0
                ? {
                    ready: true,
                    reason: `${counts.jobs} job(s) already exist for this team.`,
                    action: "Turn this on when you want direct job visibility.",
                }
                : {
                    ready: false,
                    reason: "No queued or historical jobs exist yet.",
                    action: "Run a campaign or background workflow first.",
                };
        case "knowledge":
            return counts.knowledgeBases > 0
                ? {
                    ready: true,
                    reason: `${counts.knowledgeBases} knowledge base item(s) already exist.`,
                    action: "Turn this on when knowledge workflows should be visible.",
                }
                : {
                    ready: false,
                    reason: "No knowledge base content has been created yet.",
                    action: "Upload or create at least one knowledge base first.",
                };
        case "linkedin-runner":
            return context.hasLinkedInRuntime
                ? {
                    ready: true,
                    reason: "A LinkedIn execution path is configured through the extension or browser node.",
                    action: "Turn this on when LinkedIn automation should be exposed.",
                }
                : {
                    ready: false,
                    reason: "No LinkedIn execution runtime is configured.",
                    action: "Set EXTENSION_API_KEY or BROWSER_NODE_URL/BROWSER_WS_ENDPOINT first.",
                };
        case "marketplace":
            return context.marketplaceTemplateCount > 0
                ? {
                    ready: true,
                    reason: `${context.marketplaceTemplateCount} marketplace template(s) are available.`,
                    action: "Turn this on when installs should be discoverable.",
                }
                : {
                    ready: false,
                    reason: "No marketplace templates are seeded yet.",
                    action: "Seed marketplace templates before exposing this section.",
                };
        case "playbooks":
            return counts.playbooks > 0
                ? {
                    ready: true,
                    reason: `${counts.playbooks} playbook(s) are already available for this team.`,
                    action: "Turn this on when the team should manage playbooks directly.",
                }
                : {
                    ready: false,
                    reason: "There are no playbooks yet.",
                    action: "Create or seed at least one playbook first.",
                };
        case "runtime":
            return context.policy?.productSurface === "runtime" || context.edgeAvailability.configured
                ? {
                    ready: true,
                    reason: context.policy?.productSurface === "runtime"
                        ? "This workspace is already marked for the runtime product surface."
                        : "An edge/runtime endpoint is configured for this workspace.",
                    action: "Turn this on when runtime controls should be visible.",
                }
                : {
                    ready: false,
                    reason: "This workspace is still running in the outreach surface without runtime binding.",
                    action: "Switch the product surface to runtime or configure edge runtime first.",
                };
        case "scraper-bridge":
            return context.hasScraperSecret || counts.scrapingJobs > 0
                ? {
                    ready: true,
                    reason: counts.scrapingJobs > 0
                        ? `${counts.scrapingJobs} scraping job(s) already exist for this team.`
                        : "Scraper ingress secrets are configured.",
                    action: "Turn this on when scraper operations should be visible.",
                }
                : {
                    ready: false,
                    reason: "No scraper secret or scrape activity exists yet.",
                    action: "Configure SCRAPER_SECRET or run scraper ingestion first.",
                };
        case "sovereign":
            return context.strictSovereignty || context.edgeAvailability.configured
                ? {
                    ready: true,
                    reason: context.strictSovereignty
                        ? "Strict sovereignty mode is enabled."
                        : "Edge runtime is configured for sovereignty-sensitive routing.",
                    action: "Turn this on when sovereignty controls should be exposed.",
                }
                : {
                    ready: false,
                    reason: "No strict sovereignty mode or edge runtime is configured yet.",
                    action: "Set STRICT_SOVEREIGNTY=true or configure edge runtime first.",
                };
        case "studio":
            return context.hasAiProvider
                ? {
                    ready: true,
                    reason: "AI providers are configured, so studio generation can run.",
                    action: "Turn this on when prompt and draft tooling should be available.",
                }
                : {
                    ready: false,
                    reason: "Studio should stay hidden until an AI provider is configured.",
                    action: "Add Gemini, OpenAI, or Anthropic credentials first.",
                };
        case "workflows":
            return counts.workflows > 0
                ? {
                    ready: true,
                    reason: `${counts.workflows} workflow(s) already exist for this team.`,
                    action: "Turn this on when operators should manage workflow runs.",
                }
                : {
                    ready: false,
                    reason: "There are no saved workflows yet.",
                    action: "Create or import at least one workflow first.",
                };
        default:
            return {
                ready: false,
                reason: "This feature does not have a readiness rule yet.",
                action: "Review before exposing it.",
            };
    }
}

/**
 * The per-team enabled hidden-feature set, resolved from an already-loaded context.
 * - `team.enabledFeatures` is a JSON string[] -> that explicit choice (validated).
 * - `team.enabledFeatures` is null -> the team never customized, so the defaults
 *   are readiness-gated: every feature whose backend is configured/ready.
 * The env override (NEXT_PUBLIC_ENABLED_HIDDEN_FEATURES) is always unioned in.
 */
export function resolveEnabledFeatureKeysFromContext(
    context: Awaited<ReturnType<typeof loadFeatureContext>>
): Set<HiddenFeatureKey> {
    const stored = context.team.enabledFeatures;
    const envDefaults = getDefaultEnabledHiddenFeatureKeys();

    if (Array.isArray(stored)) {
        return mergeEnabledHiddenFeatureKeys(
            envDefaults,
            parseEnabledHiddenFeatureKeys(stored.map((value) => String(value)).join(","))
        );
    }

    const readyKeys = Object.values(HIDDEN_FEATURES)
        .filter((feature) => resolveReadiness(feature.key, context).ready)
        .map((feature) => feature.key);

    return mergeEnabledHiddenFeatureKeys(envDefaults, readyKeys);
}

export async function resolveEnabledFeatureKeys(teamId: string): Promise<Set<HiddenFeatureKey>> {
    const context = await loadFeatureContext(teamId);
    return resolveEnabledFeatureKeysFromContext(context);
}
