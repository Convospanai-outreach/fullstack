// Rejects known sample/default secret values at startup so a misconfigured
// production deploy fails fast instead of silently running with a public
// fallback secret (roadmap.md item 1.8).
const SAMPLE_ENCRYPTION_KEY = "0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef";
const SAMPLE_NEXTAUTH_SECRET = "your-secret-key-here";
const SAMPLE_CRON_SECRET = "change-me";

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

    if (problems.length > 0) {
        throw new Error(`Refusing to start in production with unsafe secrets:\n- ${problems.join("\n- ")}`);
    }
}
