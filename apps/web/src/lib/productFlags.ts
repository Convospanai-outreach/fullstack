export const PRODUCT_FLAGS = {
    betaMode: true,
    emailFirstBeta: true,
    enableLinkedInAutomation: false,
    enableEdgeRuntime: false,
    enableCallerWorkspace: false,
    enablePlaybooks: false,
    enableWorkflows: false,
    enableStudio: false,
    enableMarketplace: false,
    enableKnowledgeBase: false,
    enableAgentBuilder: false,
};

export const BETA_DISABLED_PATH_PREFIXES = [
    "/agents",
    "/caller",
    "/command-center",
    "/csv-ingestion",
    "/edge",
    "/hunter-email-finder",
    "/jobs",
    "/knowledge",
    "/linkedin-runner",
    "/marketplace",
    "/playbooks",
    "/runtime",
    "/scraper-bridge",
    "/sovereign",
    "/studio",
    "/workflows",
];

export function isPathEnabled(pathname: string) {
    if (!PRODUCT_FLAGS.betaMode) {
        return true;
    }

    return !BETA_DISABLED_PATH_PREFIXES.some((prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`));
}
