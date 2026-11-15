// CI guard: a table created by a Prisma migration must also have row level security
// enabled by some migration. The app connects as postgres (BYPASSRLS), so nothing in
// the app notices a table without RLS, but Supabase exposes the public schema to the
// anon and authenticated roles and such a table is readable with the anon key.
//
// Tables from migrations up to and including RLS_BASELINE are not checked: prod already
// had RLS on all of them (116 were enabled directly in Supabase, the rest by the
// baseline migration itself). Only newer migrations are held to the rule.
import fs from "node:fs";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";

export const RLS_BASELINE = "20261114100000_enable_rls_remaining_tables";

export const MIGRATION_DIRS = [
  "packages/db/prisma/migrations",
  "apps/api/prisma/migrations",
  "apps/web/prisma/migrations",
];

// Optional "IF NOT EXISTS" / "ONLY" / schema, then a quoted or bare name.
const NAME = String.raw`(?:"?public"?\.)?(?:"([^"]+)"|([A-Za-z_][A-Za-z0-9_$]*))`;
const CREATE = new RegExp(String.raw`^\s*CREATE\s+TABLE\s+(?:IF\s+NOT\s+EXISTS\s+)?${NAME}`, "gim");
const ENABLE = new RegExp(
  String.raw`^\s*ALTER\s+TABLE\s+(?:IF\s+EXISTS\s+)?(?:ONLY\s+)?${NAME}\s+ENABLE\s+ROW\s+LEVEL\s+SECURITY`,
  "gim",
);

// Quoted names keep their case; bare names fold to lower case, as in Postgres.
function names(sql, re) {
  return [...sql.matchAll(re)].map((m) => m[1] ?? m[2].toLowerCase());
}

export function findTablesWithoutRls(migrationsDir) {
  const created = [];
  const secured = new Set();
  const migrations = fs
    .readdirSync(migrationsDir, { withFileTypes: true })
    .filter((e) => e.isDirectory())
    .map((e) => e.name)
    .sort();
  for (const name of migrations) {
    const file = path.join(migrationsDir, name, "migration.sql");
    if (!fs.existsSync(file)) continue;
    const sql = fs.readFileSync(file, "utf8");
    if (name > RLS_BASELINE) created.push(...names(sql, CREATE));
    for (const t of names(sql, ENABLE)) secured.add(t);
  }
  return [...new Set(created)].filter((t) => !secured.has(t));
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  let failed = false;
  for (const dir of MIGRATION_DIRS) {
    const missing = findTablesWithoutRls(path.resolve(dir));
    if (missing.length) {
      failed = true;
      console.error(`${dir}: tables created without ENABLE ROW LEVEL SECURITY: ${missing.join(", ")}`);
    }
  }
  if (failed) {
    console.error('Add ALTER TABLE "public"."<Table>" ENABLE ROW LEVEL SECURITY; to the migration.');
    process.exit(1);
  }
  console.log("RLS guard: every table created after the baseline has RLS enabled.");
}
