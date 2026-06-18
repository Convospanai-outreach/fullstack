import { createHash } from "node:crypto";
import fs from "node:fs";

const checks = [];
const args = new Set(process.argv.slice(2));
const productionMode =
  args.has("--production") ||
  args.has("--mode=production") ||
  process.env.SCHEMA_VERIFY_MODE === "production";

const requiredProductionEnv = [
  "EXPECTED_PRISMA_MIGRATION_COUNT",
  "EXPECTED_PRISMA_LATEST_MIGRATION",
  "EXPECTED_SCHEMA_FINGERPRINT",
];

const requiredObjects = [
  {
    label: "User.clerk_user_id",
    table: "User",
    columns: [{ name: "clerk_user_id", dataType: "text", nullable: true }],
  },
  {
    label: "UserInvitation",
    table: "UserInvitation",
    columns: [
      { name: "id", dataType: "text", nullable: false },
      { name: "email", dataType: "text", nullable: false },
      { name: "role", nullable: false },
      { name: "teamId", dataType: "text", nullable: false },
      { name: "invitedById", dataType: "text", nullable: false },
      { name: "tokenHash", dataType: "text", nullable: false },
      { name: "status", nullable: false },
      { name: "expiresAt", nullable: false },
      { name: "acceptedAt", nullable: true },
      { name: "invite_request_id", dataType: "text", nullable: true },
      { name: "createdAt", nullable: false },
    ],
    uniqueSets: [["tokenHash"]],
  },
  {
    label: "invite_requests",
    table: "invite_requests",
    columns: [
      { name: "id", dataType: "text", nullable: false },
      { name: "name", dataType: "text", nullable: false },
      { name: "email", dataType: "text", nullable: false },
      { name: "company", dataType: "text", nullable: true },
      { name: "linkedin_url", dataType: "text", nullable: true },
      { name: "use_case", dataType: "text", nullable: true },
      { name: "status", nullable: false },
      { name: "invite_token", dataType: "text", nullable: true },
      { name: "approved_by_id", dataType: "text", nullable: true },
      { name: "approved_at", nullable: true },
      { name: "used_at", nullable: true },
      { name: "created_at", nullable: false },
      { name: "updated_at", nullable: false },
    ],
    uniqueSets: [["email"], ["invite_token"]],
  },
  {
    label: "ConnectedMailbox",
    table: "ConnectedMailbox",
    columns: [
      { name: "id", dataType: "text", nullable: false },
      { name: "teamId", dataType: "text", nullable: false },
      { name: "assignedUserId", dataType: "text", nullable: true },
      { name: "provider", dataType: "text", nullable: false },
      { name: "authType", dataType: "text", nullable: false },
      { name: "email", dataType: "text", nullable: false },
      { name: "status", dataType: "text", nullable: false },
      { name: "scopes", dataType: "ARRAY", nullable: false },
      { name: "encryptedAccessToken", dataType: "jsonb", nullable: true },
      { name: "encryptedRefreshToken", dataType: "jsonb", nullable: true },
      { name: "dailyLimit", dataType: "integer", nullable: false },
      { name: "sentToday", dataType: "integer", nullable: false },
      { name: "metadata", dataType: "jsonb", nullable: true },
      { name: "createdAt", nullable: false },
      { name: "updatedAt", nullable: false },
    ],
    uniqueSets: [["teamId", "email"]],
  },
  {
    label: "Email",
    table: "Email",
    columns: [
      { name: "id", dataType: "text", nullable: false },
      { name: "leadId", dataType: "text", nullable: false },
      { name: "campaignId", dataType: "text", nullable: false },
      { name: "mailboxId", dataType: "text", nullable: true },
      { name: "subject", dataType: "text", nullable: false },
      { name: "body", dataType: "text", nullable: false },
      { name: "status", dataType: "text", nullable: false },
      { name: "providerId", dataType: "text", nullable: true },
      { name: "threadId", dataType: "text", nullable: true },
      { name: "trackingId", dataType: "text", nullable: true },
      { name: "createdAt", nullable: false },
    ],
    uniqueSets: [["trackingId"]],
  },
  {
    label: "SuppressionEntry",
    table: "SuppressionEntry",
    columns: [
      { name: "id", dataType: "text", nullable: false },
      { name: "teamId", dataType: "text", nullable: false },
      { name: "email", dataType: "text", nullable: false },
      { name: "reason", dataType: "text", nullable: false },
      { name: "source", dataType: "text", nullable: false },
      { name: "leadId", dataType: "text", nullable: true },
      { name: "createdBy", dataType: "text", nullable: true },
      { name: "createdAt", nullable: false },
    ],
    uniqueSets: [["teamId", "email"]],
  },
  {
    label: "EmailEvent",
    table: "EmailEvent",
    columns: [
      { name: "id", dataType: "text", nullable: false },
      { name: "teamId", dataType: "text", nullable: false },
      { name: "emailId", dataType: "text", nullable: true },
      { name: "mailboxId", dataType: "text", nullable: true },
      { name: "leadId", dataType: "text", nullable: true },
      { name: "campaignId", dataType: "text", nullable: true },
      { name: "type", dataType: "text", nullable: false },
      { name: "provider", dataType: "text", nullable: true },
      { name: "providerMessageId", dataType: "text", nullable: true },
      { name: "payload", dataType: "jsonb", nullable: true },
      { name: "createdAt", nullable: false },
    ],
    uniqueSets: [["teamId", "provider", "providerMessageId", "type"]],
  },
  {
    label: "TrackedLink",
    table: "TrackedLink",
    columns: [
      { name: "id", dataType: "text", nullable: false },
      { name: "teamId", dataType: "text", nullable: false },
      { name: "emailId", dataType: "text", nullable: true },
      { name: "mailboxId", dataType: "text", nullable: true },
      { name: "campaignId", dataType: "text", nullable: true },
      { name: "leadId", dataType: "text", nullable: true },
      { name: "trackingKey", dataType: "text", nullable: false },
      { name: "destinationUrl", dataType: "text", nullable: false },
      { name: "status", dataType: "text", nullable: false },
      { name: "clickCount", dataType: "integer", nullable: false },
      { name: "createdAt", nullable: false },
      { name: "updatedAt", nullable: false },
    ],
    uniqueSets: [["teamId", "trackingKey"]],
  },
];

function addCheck(name, passed, detail) {
  checks.push({ name, passed, detail });
  console.log(`${passed ? "[PASS]" : "[FAIL]"} ${name}: ${detail}`);
}

function redact(value) {
  return String(value)
    .replace(/(postgres(?:ql)?:\/\/)([^:@/]+):([^@/]+)@/gi, "$1$2:[REDACTED]@")
    .replace(/([?&](?:password|sslpassword|token|key|secret)=)[^&]+/gi, "$1[REDACTED]");
}

function getDatabaseUrl() {
  const url =
    process.env.SCHEMA_VERIFY_DATABASE_URL ||
    process.env.DATABASE_URL ||
    process.env.DIRECT_URL;

  if (!url) {
    throw new Error("Missing SCHEMA_VERIFY_DATABASE_URL, DATABASE_URL, or DIRECT_URL.");
  }

  return url;
}

function shouldUseSsl(connectionString) {
  try {
    const parsed = new URL(connectionString);
    return parsed.searchParams.get("sslmode") === "require";
  } catch {
    return false;
  }
}

function requireProductionEnv() {
  if (!productionMode) {
    return;
  }

  const missing = requiredProductionEnv.filter((key) => !process.env[key]);
  const hasExpectedNames = Boolean(process.env.EXPECTED_PRISMA_MIGRATION_NAMES || process.env.SCHEMA_VERIFY_MANIFEST);

  if (!hasExpectedNames) {
    missing.push("EXPECTED_PRISMA_MIGRATION_NAMES or SCHEMA_VERIFY_MANIFEST");
  }

  if (missing.length > 0) {
    throw new Error(`Production schema verification missing required env: ${missing.join(", ")}.`);
  }
}

function parseExpectedNames() {
  const manifestPath = process.env.SCHEMA_VERIFY_MANIFEST;
  if (manifestPath) {
    const manifest = JSON.parse(fs.readFileSync(manifestPath, "utf8"));
    const names = manifest.expectedMigrations?.map((entry) => entry.name).filter(Boolean);
    if (names?.length) {
      return names;
    }
  }

  return (process.env.EXPECTED_PRISMA_MIGRATION_NAMES || "")
    .split(/[\n,]/)
    .map((name) => name.trim())
    .filter(Boolean);
}

async function one(pool, query, values = []) {
  const result = await pool.query(query, values);
  return result.rows[0];
}

async function many(pool, query, values = []) {
  const result = await pool.query(query, values);
  return result.rows;
}

function normalizeColumns(columns) {
  return [...columns].sort((a, b) => a.localeCompare(b));
}

function sameColumnSet(actual, expected) {
  const normalizedActual = normalizeColumns(actual);
  const normalizedExpected = normalizeColumns(expected);
  return (
    normalizedActual.length === normalizedExpected.length &&
    normalizedActual.every((value, index) => value === normalizedExpected[index])
  );
}

function sameOrderedList(actual, expected) {
  return actual.length === expected.length && actual.every((value, index) => value === expected[index]);
}

async function checkTableShape(pool, shape) {
  const columns = await many(
    pool,
    `
    SELECT column_name, data_type, udt_name, is_nullable
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = $1;
    `,
    [shape.table]
  );
  const columnByName = new Map(columns.map((column) => [column.column_name, column]));

  if (columns.length === 0) {
    addCheck(`${shape.label} canonical table`, false, "missing table");
    return;
  }

  const missing = [];
  const mismatched = [];

  for (const expected of shape.columns) {
    const actual = columnByName.get(expected.name);
    if (!actual) {
      missing.push(expected.name);
      continue;
    }

    const actualType = actual.data_type === "USER-DEFINED" ? actual.udt_name : actual.data_type;
    const actualNullable = actual.is_nullable === "YES";
    if (expected.dataType && actualType !== expected.dataType) {
      mismatched.push(`${expected.name} type=${actualType}, expected=${expected.dataType}`);
    }
    if (typeof expected.nullable === "boolean" && actualNullable !== expected.nullable) {
      mismatched.push(`${expected.name} nullable=${actualNullable}, expected=${expected.nullable}`);
    }
  }

  addCheck(
    `${shape.label} canonical columns`,
    missing.length === 0 && mismatched.length === 0,
    missing.length || mismatched.length
      ? `missing=[${missing.join(", ")}]; mismatched=[${mismatched.join("; ")}]`
      : `${shape.columns.length} required columns present`
  );

  for (const uniqueSet of shape.uniqueSets || []) {
    const rows = await many(
      pool,
      `
      SELECT
        i.relname AS index_name,
        array_agg(a.attname ORDER BY key_position.ordinality)::text[] AS columns
      FROM pg_class t
      JOIN pg_namespace n ON n.oid = t.relnamespace
      JOIN pg_index ix ON ix.indrelid = t.oid
      JOIN pg_class i ON i.oid = ix.indexrelid
      JOIN unnest(ix.indkey) WITH ORDINALITY AS key_position(attnum, ordinality) ON true
      JOIN pg_attribute a ON a.attrelid = t.oid AND a.attnum = key_position.attnum
      WHERE n.nspname = 'public'
        AND t.relname = $1
        AND ix.indisunique
      GROUP BY i.relname;
      `,
      [shape.table]
    );

    const found = rows.some((row) => sameColumnSet(row.columns, uniqueSet));
    addCheck(
      `${shape.label} unique(${uniqueSet.join(",")})`,
      found,
      found ? "present" : "missing"
    );
  }
}

async function main() {
  let pool;

  try {
    requireProductionEnv();

    const connectionString = getDatabaseUrl();
    const { Pool } = await import("pg");
    pool = new Pool({
      connectionString,
      ssl: shouldUseSsl(connectionString) ? { rejectUnauthorized: false } : undefined,
      max: 1,
      connectionTimeoutMillis: 10_000,
      idleTimeoutMillis: 1_000,
    });

    const migrationRows = await many(
      pool,
      `
      SELECT migration_name, started_at, finished_at
      FROM public._prisma_migrations
      ORDER BY started_at ASC, migration_name ASC;
      `
    );
    const migrationNames = migrationRows.map((row) => row.migration_name);
    const latestMigration = migrationRows.at(-1)?.migration_name ?? null;
    const expectedCount = process.env.EXPECTED_PRISMA_MIGRATION_COUNT;
    const expectedLatest = process.env.EXPECTED_PRISMA_LATEST_MIGRATION;
    const expectedNames = parseExpectedNames();

    addCheck(
      "Prisma migration count",
      expectedCount ? migrationNames.length === Number(expectedCount) : migrationNames.length > 0,
      expectedCount
        ? `actual=${migrationNames.length}; expected=${expectedCount}`
        : `actual=${migrationNames.length}; EXPECTED_PRISMA_MIGRATION_COUNT not set`
    );

    addCheck(
      "Prisma latest migration",
      expectedLatest ? latestMigration === expectedLatest : Boolean(latestMigration),
      expectedLatest
        ? `actual=${latestMigration ?? "null"}; expected=${expectedLatest}`
        : `actual=${latestMigration ?? "null"}; EXPECTED_PRISMA_LATEST_MIGRATION not set`
    );

    addCheck(
      "Prisma migration names",
      expectedNames.length > 0 && sameOrderedList(migrationNames, expectedNames),
      expectedNames.length > 0
        ? `actual=${migrationNames.length} names; expected=${expectedNames.length} names`
        : "missing EXPECTED_PRISMA_MIGRATION_NAMES or SCHEMA_VERIFY_MANIFEST"
    );

    const leadEmbedding = await one(
      pool,
      `
      SELECT data_type || ':' || udt_name AS lead_embedding_type
      FROM information_schema.columns
      WHERE table_schema = 'public'
        AND table_name = 'Lead'
        AND column_name = 'embedding';
      `
    );
    const expectedEmbedding = process.env.EXPECTED_LEAD_EMBEDDING_TYPE;
    addCheck(
      "Lead.embedding type",
      expectedEmbedding
        ? leadEmbedding?.lead_embedding_type === expectedEmbedding
        : Boolean(leadEmbedding?.lead_embedding_type),
      expectedEmbedding
        ? `actual=${leadEmbedding?.lead_embedding_type ?? "null"}; expected=${expectedEmbedding}`
        : `actual=${leadEmbedding?.lead_embedding_type ?? "null"}; EXPECTED_LEAD_EMBEDDING_TYPE not set`
    );

    for (const shape of requiredObjects) {
      await checkTableShape(pool, shape);
    }

    const edgeNodePreflight = await one(
      pool,
      `
      SELECT
        COUNT(*)::text AS edge_node_count,
        COUNT(*) FILTER (
          WHERE NOT EXISTS (
            SELECT 1 FROM public."Team" WHERE public."Team"."id" = public."EdgeNode"."teamId"
          )
        )::text AS orphan_edge_node_count
      FROM public."EdgeNode";
      `
    );
    const orphanEdgeNodes = Number(edgeNodePreflight.orphan_edge_node_count);
    addCheck(
      "EdgeNode orphan preflight",
      orphanEdgeNodes === 0,
      `edge_node_count=${edgeNodePreflight.edge_node_count}; orphan_edge_node_count=${orphanEdgeNodes}`
    );

    const fingerprint = await one(
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

    const expectedFingerprint = process.env.EXPECTED_SCHEMA_FINGERPRINT;
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
    await pool?.end().catch(() => undefined);
  }
}

main();
