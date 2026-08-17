export const PRODUCT_FLAGS = {
    betaMode: true,
    emailFirstBeta: true,
};

export const HIDDEN_FEATURES_COOKIE = "convo-hidden-features";

export type HiddenFeatureKey =
    | "agents"
    | "caller"
    | "command-center"
    | "csv-ingestion"
    | "edge"
    | "hunter-email-finder"
    | "jobs"
    | "knowledge"
    | "linkedin-runner"
    | "marketplace"
    | "playbooks"
    | "runtime"
    | "scraper-bridge"
    | "sovereign"
    | "studio"
    | "workflows";

export interface HiddenFeatureDefinition {
    key: HiddenFeatureKey;
    label: string;
    description: string;
    openPath: string;
    pathPrefixes: string[];
    /** False when openPath doesn't resolve to a built page yet — hides the "Open Surface" link. */
    built: boolean;
}

const UNBUILT_FEATURE_KEYS: ReadonlySet<HiddenFeatureKey> = new Set(["command-center", "runtime", "sovereign", "edge"]);

type HiddenFeatureBase = Omit<HiddenFeatureDefinition, "built">;

const HIDDEN_FEATURES_BASE: Record<HiddenFeatureKey, HiddenFeatureBase> = {
    "agents": {
        key: "agents",
        label: "Agent Swarm",
        description: "Autonomous and semi-autonomous agent workspaces.",
        openPath: "/agents/swarm",
        pathPrefixes: ["/agents"],
    },
    "caller": {
        key: "caller",
        label: "Caller Workspace",
        description: "Dedicated caller workflows and queue handling.",
        openPath: "/caller",
        pathPrefixes: ["/caller"],
    },
    "command-center": {
        key: "command-center",
        label: "Command Center",
        description: "Operations overview for orchestrated runs and supervision.",
        openPath: "/command-center",
        pathPrefixes: ["/command-center"],
    },
    "csv-ingestion": {
        key: "csv-ingestion",
        label: "CSV Ingestion",
        description: "Bulk lead import and normalization workflows.",
        openPath: "/csv-ingestion",
        pathPrefixes: ["/csv-ingestion"],
    },
    "edge": {
        key: "edge",
        label: "Edge Runtime",
        description: "Edge runtime setup, diagnostics, and hardware-aware operations.",
        openPath: "/edge",
        pathPrefixes: ["/edge"],
    },
    "hunter-email-finder": {
        key: "hunter-email-finder",
        label: "Hunter Email Finder",
        description: "Email discovery and verification workflows powered by Hunter.",
        openPath: "/hunter-email-finder",
        pathPrefixes: ["/hunter-email-finder"],
    },
    "jobs": {
        key: "jobs",
        label: "Jobs",
        description: "Queued job visibility and debugging tools.",
        openPath: "/jobs",
        pathPrefixes: ["/jobs"],
    },
    "knowledge": {
        key: "knowledge",
        label: "Knowledge Base",
        description: "Knowledge ingestion, retrieval, and grounding surfaces.",
        openPath: "/knowledge",
        pathPrefixes: ["/knowledge"],
    },
    "linkedin-runner": {
        key: "linkedin-runner",
        label: "LinkedIn Runner",
        description: "Execution controls for LinkedIn automation and browser flows.",
        openPath: "/linkedin-runner",
        pathPrefixes: ["/linkedin-runner"],
    },
    "marketplace": {
        key: "marketplace",
        label: "Marketplace",
        description: "Template and capability installation surface.",
        openPath: "/marketplace",
        pathPrefixes: ["/marketplace"],
    },
    "playbooks": {
        key: "playbooks",
        label: "Playbooks",
        description: "Reusable campaign and outreach playbooks.",
        openPath: "/playbooks",
        pathPrefixes: ["/playbooks"],
    },
    "runtime": {
        key: "runtime",
        label: "Runtime",
        description: "Runtime control, diagnostics, and execution surfaces.",
        openPath: "/runtime",
        pathPrefixes: ["/runtime"],
    },
    "scraper-bridge": {
        key: "scraper-bridge",
        label: "Scraper Bridge",
        description: "Ingress and orchestration surface for scrape-driven workflows.",
        openPath: "/scraper-bridge",
        pathPrefixes: ["/scraper-bridge"],
    },
    "sovereign": {
        key: "sovereign",
        label: "Sovereign Controls",
        description: "Residency, compliance, and sovereign execution surfaces.",
        openPath: "/sovereign",
        pathPrefixes: ["/sovereign"],
    },
    "studio": {
        key: "studio",
        label: "Studio",
        description: "Prompting, copy, and workflow composition workspace.",
        openPath: "/studio",
        pathPrefixes: ["/studio"],
    },
    "workflows": {
        key: "workflows",
        label: "Workflows",
        description: "Visual workflow builder and run management.",
        openPath: "/workflows",
        pathPrefixes: ["/workflows"],
    },
};

export const HIDDEN_FEATURES: Record<HiddenFeatureKey, HiddenFeatureDefinition> = Object.fromEntries(
    Object.entries(HIDDEN_FEATURES_BASE).map(([key, feature]) => [
        key,
        { ...feature, built: !UNBUILT_FEATURE_KEYS.has(feature.key) },
    ])
) as Record<HiddenFeatureKey, HiddenFeatureDefinition>;

const HIDDEN_FEATURE_KEYS = Object.keys(HIDDEN_FEATURES) as HiddenFeatureKey[];
const HIDDEN_FEATURE_KEY_SET = new Set<HiddenFeatureKey>(HIDDEN_FEATURE_KEYS);

export const BETA_DISABLED_PATH_PREFIXES = HIDDEN_FEATURE_KEYS.flatMap((key) => HIDDEN_FEATURES[key].pathPrefixes);

function normalizeFeatureKey(value: string): HiddenFeatureKey | null {
    const normalized = value.trim().toLowerCase() as HiddenFeatureKey;
    return HIDDEN_FEATURE_KEY_SET.has(normalized) ? normalized : null;
}

export function parseEnabledHiddenFeatureKeys(raw?: string | null): Set<HiddenFeatureKey> {
    if (!raw) {
        return new Set<HiddenFeatureKey>();
    }

    return new Set(
        raw
            .split(/[,\s]+/)
            .map(normalizeFeatureKey)
            .filter((value): value is HiddenFeatureKey => value !== null)
    );
}

export function serializeEnabledHiddenFeatureKeys(keys: Iterable<HiddenFeatureKey>): string {
    return Array.from(new Set(keys))
        .filter((key) => HIDDEN_FEATURE_KEY_SET.has(key))
        .sort()
        .join(",");
}

const DEFAULT_ENABLED_HIDDEN_FEATURES = parseEnabledHiddenFeatureKeys(
    process.env["NEXT_PUBLIC_ENABLED_HIDDEN_FEATURES"] || ""
);

export function getDefaultEnabledHiddenFeatureKeys(): Set<HiddenFeatureKey> {
    return new Set(DEFAULT_ENABLED_HIDDEN_FEATURES);
}

export function mergeEnabledHiddenFeatureKeys(
    ...collections: Array<Iterable<HiddenFeatureKey> | undefined | null>
): Set<HiddenFeatureKey> {
    const merged = new Set<HiddenFeatureKey>();

    for (const collection of collections) {
        if (!collection) {
            continue;
        }

        for (const key of collection) {
            if (HIDDEN_FEATURE_KEY_SET.has(key)) {
                merged.add(key);
            }
        }
    }

    return merged;
}

export function getHiddenFeatureForPath(pathname: string): HiddenFeatureDefinition | null {
    for (const key of HIDDEN_FEATURE_KEYS) {
        const feature = HIDDEN_FEATURES[key];
        if (feature.pathPrefixes.some((prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`))) {
            return feature;
        }
    }

    return null;
}

export function isHiddenFeatureEnabled(
    featureKey: HiddenFeatureKey,
    enabledKeys?: Iterable<HiddenFeatureKey>
): boolean {
    const enabled = enabledKeys ? new Set(enabledKeys) : getDefaultEnabledHiddenFeatureKeys();
    return enabled.has(featureKey);
}

export function isPathEnabled(pathname: string, enabledKeys?: Iterable<HiddenFeatureKey>) {
    if (!PRODUCT_FLAGS.betaMode) {
        return true;
    }

    const feature = getHiddenFeatureForPath(pathname);
    if (!feature) {
        return true;
    }

    return isHiddenFeatureEnabled(feature.key, enabledKeys);
}
