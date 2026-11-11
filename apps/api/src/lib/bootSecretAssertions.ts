// Rejects known sample/default secret values at startup so a misconfigured
// production deploy fails fast instead of silently running with a public
// fallback secret (roadmap.md item 1.8).
const SAMPLE_ENCRYPTION_KEY = "0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef";
const SAMPLE_NEXTAUTH_SECRET = "your-secret-key-here";
const SAMPLE_CRON_SECRET = "change-me";

// The edge node is a machine the owner runs, so loopback and private addresses are legitimate
// targets. What must never be reachable through it is the cloud metadata service or a wildcard
// address, which only a misconfigured or injected value would name.
function onPremEndpointProblem(raw: string | undefined): string | null {
    if (!raw) return null;
    let url: URL;
    try {
        url = new URL(raw);
    } catch {
        return "ON_PREM_AI_ENDPOINT / EDGE_NODE_URI is not a valid URL";
    }
    if (url.protocol !== "http:" && url.protocol !== "https:") {
        return `ON_PREM_AI_ENDPOINT / EDGE_NODE_URI scheme "${url.protocol}" is not allowed, use http or https`;
    }
    const host = url.hostname.toLowerCase().replace(/^\[|\]$/g, "");
    if (/^169\.254\./.test(host) || /^fe80:/.test(host) || /^fd00:ec2:/.test(host) || host === "0.0.0.0" || host === "::" || host === "metadata.google.internal") {
        return `ON_PREM_AI_ENDPOINT / EDGE_NODE_URI host "${host}" is a link-local, metadata or wildcard address (possible SSRF)`;
    }
    return null;
}

export function assertProductionSecretsAreSafe(env: NodeJS.ProcessEnv = process.env): void {
    if (env["NODE_ENV"] !== "production") {
        return;
    }

    const problems: string[] = [];

    if (env["ENCRYPTION_KEY"] === SAMPLE_ENCRYPTION_KEY) {
        problems.push("ENCRYPTION_KEY is still the sample value from .env.example");
    }
    if (env["NEXTAUTH_SECRET"] === SAMPLE_NEXTAUTH_SECRET) {
        problems.push("NEXTAUTH_SECRET is still the sample value from .env.example");
    }
    if (env["CRON_SECRET"] === SAMPLE_CRON_SECRET) {
        problems.push('CRON_SECRET is still the "change-me" default');
    }
    if (!env["BLIND_INDEX_KEY"] && !env["ENCRYPTION_KEY"]) {
        problems.push("BLIND_INDEX_KEY is not set and ENCRYPTION_KEY is not set either, so blind indexing would silently fall back to a hard-coded default salt");
    }

    const onPremProblem = onPremEndpointProblem(env["ON_PREM_AI_ENDPOINT"] || env["EDGE_NODE_URI"]);
    if (onPremProblem) problems.push(onPremProblem);

    if (problems.length > 0) {
        throw new Error(`Refusing to start in production with unsafe secrets:\n- ${problems.join("\n- ")}`);
    }

    // Rate limits are per process without Redis, so N replicas allow N times the limit. Loud but not
    // fatal: the API runs fine on one instance, so a missing URL must not stop a deploy from booting.
    if (!(env["REDIS_URL"] || "").trim() && env["DISABLE_REDIS"] !== "true") {
        console.error("CRITICAL: REDIS_URL is not set in production. Rate limiting is per process and unsafe with more than one API instance. Set REDIS_URL, or DISABLE_REDIS=true to silence this on a single-instance deploy.");
    }
}
