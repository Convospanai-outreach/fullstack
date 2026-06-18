import { createHash } from "crypto";
import { Pool } from "pg";

type Check = {
    name: string;
    passed: boolean;
    detail: string;
};

const checks: Check[] = [];

function addCheck(name: string, passed: boolean, detail: string) {
    checks.push({ name, passed, detail });
    console.log(`${passed ? "[PASS]" : "[FAIL]"} ${name}: ${detail}`);
}

function redact(value: string) {
    return value
        .replace(/(postgres(?:ql)?:\/\/)([^:@/]+):([^@/]+)@/gi, "$1$2:[REDACTED]@")
        .replace(/([?&](?:password|sslpassword|token|key|secret)=)[^&]+/gi, "$1[REDACTED]");
}

function getDatabaseUrl() {
    const url =
        process.env["SCHEMA_VERIFY_DATABASE_URL"] ||
        process.env["DATABASE_URL"] ||
        process.env["DIRECT_URL"];

    if (!url) {
        throw new Error("Missing SCHEMA_VERIFY_DATABASE_URL, DATABASE_URL, or DIRECT_URL.");
    }

    return url;
}

function shouldUseSsl(connectionString: string) {
    try {
        const parsed = new URL(connectionString);
        return parsed.searchParams.get("sslmode") === "require";
    } catch {
        return false;
    }
}

async function one<T>(pool: Pool, query: string, values: unknown[] = []): Promise<T> {
    const result = await pool.query(query, values);
    return result.rows[0] as T;
}

async function main() {
    const connectionString = getDatabaseUrl();
    const pool = new Pool({
        connectionString,
        ssl: shouldUseSsl(connectionString) ? { rejectUnauthorized: false } : undefined,
        max: 1,
        connectionTimeoutMillis: 10_000,
        idleTimeoutMillis: 1_000,
    });

    try {
        const migration = await one<{
            count: string;
            latest_migration: string | null;
        }>(
            pool,
            `
            SELECT
              COUNT(*)::text AS count,
              (
                SELECT migration_name
                FROM public._prisma_migrations
                ORDER BY started_at DESC, migration_name DESC
                LIMIT 1
              ) AS latest_migration
            FROM public._prisma_migrations;
            `
        );

        const migrationCount = Number(migration.count);
        const expectedCount = process.env["EXPECTED_PRISMA_MIGRATION_COUNT"];
        const expectedLatest = process.env["EXPECTED_PRISMA_LATEST_MIGRATION"];

        addCheck(
            "Prisma migration count",
            expectedCount ? migrationCount === Number(expectedCount) : migrationCount > 0,
            expectedCount
                ? `actual=${migrationCount}; expected=${expectedCount}`
                : `actual=${migrationCount}; EXPECTED_PRISMA_MIGRATION_COUNT not set`
        );

        addCheck(
            "Prisma latest migration",
            expectedLatest ? migration.latest_migration === expectedLatest : Boolean(migration.latest_migration),
            expectedLatest
                ? `actual=${migration.latest_migration ?? "null"}; expected=${expectedLatest}`
                : `actual=${migration.latest_migration ?? "null"}; EXPECTED_PRISMA_LATEST_MIGRATION not set`
        );

        const objects = await one<{
            user_clerk_user_id: boolean;
            user_invitation: boolean;
            invite_requests: boolean;
            lead_embedding_type: string | null;
        }>(
            pool,
            `
            SELECT
              EXISTS (
                SELECT 1 FROM information_schema.columns
                WHERE table_schema = 'public'
                  AND table_name = 'User'
                  AND column_name = 'clerk_user_id'
              ) AS user_clerk_user_id,
              EXISTS (
                SELECT 1 FROM information_schema.tables
                WHERE table_schema = 'public'
                  AND table_name = 'UserInvitation'
              ) AS user_invitation,
              EXISTS (
                SELECT 1 FROM information_schema.tables
                WHERE table_schema = 'public'
                  AND table_name = 'invite_requests'
              ) AS invite_requests,
              (
                SELECT data_type || ':' || udt_name
                FROM information_schema.columns
                WHERE table_schema = 'public'
                  AND table_name = 'Lead'
                  AND column_name = 'embedding'
              ) AS lead_embedding_type;
            `
        );

        addCheck("User.clerk_user_id", objects.user_clerk_user_id, objects.user_clerk_user_id ? "present" : "missing");
        addCheck("UserInvitation table", objects.user_invitation, objects.user_invitation ? "present" : "missing");
        addCheck("invite_requests table", objects.invite_requests, objects.invite_requests ? "present" : "missing");

        const expectedEmbedding = process.env["EXPECTED_LEAD_EMBEDDING_TYPE"];
        addCheck(
            "Lead.embedding type",
            expectedEmbedding ? objects.lead_embedding_type === expectedEmbedding : Boolean(objects.lead_embedding_type),
            expectedEmbedding
                ? `actual=${objects.lead_embedding_type ?? "null"}; expected=${expectedEmbedding}`
                : `actual=${objects.lead_embedding_type ?? "null"}; EXPECTED_LEAD_EMBEDDING_TYPE not set`
        );

        const fingerprint = await one<{ fingerprint: string }>(
            pool,
            `
            SELECT md5(
              string_agg(
                table_name || '.' || column_name || ':' || data_type || ':' ||
                COALESCE(udt_name, '') || ':' || is_nullable || ':' ||
                COALESCE(column_default, ''),
                '|' ORDER BY table_name, ordinal_position
              )
            ) AS fingerprint
            FROM information_schema.columns
            WHERE table_schema = 'public';
            `
        );

        const expectedFingerprint = process.env["EXPECTED_SCHEMA_FINGERPRINT"];
        addCheck(
            "Public schema fingerprint",
            expectedFingerprint ? fingerprint.fingerprint === expectedFingerprint : Boolean(fingerprint.fingerprint),
            expectedFingerprint
                ? `actual=${fingerprint.fingerprint}; expected=${expectedFingerprint}`
                : `actual=${fingerprint.fingerprint}; EXPECTED_SCHEMA_FINGERPRINT not set`
        );

        const summary = checks.map((check) => `${check.name}:${check.passed ? "pass" : "fail"}`).join("|");
        const summaryHash = createHash("sha256").update(summary).digest("hex").slice(0, 12);
        const failed = checks.filter((check) => !check.passed);

        console.log(`\nRead-only schema verification summary: ${checks.length - failed.length}/${checks.length} passed`);
        console.log(`Summary hash: ${summaryHash}`);

        if (failed.length > 0) {
            process.exit(1);
        }
    } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        console.error(`Schema verification failed: ${redact(message)}`);
        process.exit(1);
    } finally {
        await pool.end().catch(() => undefined);
    }
}

main();
