import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";

import { findTablesWithoutRls, MIGRATION_DIRS, RLS_BASELINE } from "./check-migration-rls.mjs";

// New tables must ship with row level security. The app connects as postgres
// (BYPASSRLS), so RLS is invisible to it; but Supabase exposes the public schema
// to anon/authenticated, and a table without RLS is readable with the anon key.

const AFTER = "20270101000000_new_thing";

function scratch(migrations) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "rls-guard-"));
  for (const [name, sql] of Object.entries(migrations)) {
    fs.mkdirSync(path.join(root, name), { recursive: true });
    fs.writeFileSync(path.join(root, name, "migration.sql"), sql);
  }
  return root;
}

test("fails a new table that has no ENABLE ROW LEVEL SECURITY", () => {
  const dir = scratch({ [AFTER]: 'CREATE TABLE "Widget" ("id" TEXT NOT NULL);' });
  assert.deepEqual(findTablesWithoutRls(dir), ["Widget"]);
});

test("passes when RLS is enabled in the same migration", () => {
  const dir = scratch({
    [AFTER]:
      'CREATE TABLE "Widget" ("id" TEXT NOT NULL);\nALTER TABLE "public"."Widget" ENABLE ROW LEVEL SECURITY;',
  });
  assert.deepEqual(findTablesWithoutRls(dir), []);
});

test("passes when RLS is enabled in a later migration", () => {
  const dir = scratch({
    [AFTER]: 'CREATE TABLE IF NOT EXISTS "public"."Widget" ("id" TEXT);',
    "20270102000000_widget_rls": 'ALTER TABLE ONLY "Widget" ENABLE ROW LEVEL SECURITY;',
  });
  assert.deepEqual(findTablesWithoutRls(dir), []);
});

test("matches unquoted names case-sensitively like Postgres folds them", () => {
  const dir = scratch({
    [AFTER]: "create table widget (id text);\nalter table widget enable row level security;",
  });
  assert.deepEqual(findTablesWithoutRls(dir), []);
});

test("ignores tables from migrations at or before the baseline", () => {
  const dir = scratch({
    "20260101000000_old": 'CREATE TABLE "Legacy" ("id" TEXT);',
    [RLS_BASELINE]: 'CREATE TABLE "AtBaseline" ("id" TEXT);',
  });
  assert.deepEqual(findTablesWithoutRls(dir), []);
});

test("a table is flagged only for its own name", () => {
  const dir = scratch({
    [AFTER]:
      'CREATE TABLE "A" ("id" TEXT);\nCREATE TABLE "B" ("id" TEXT);\nALTER TABLE "A" ENABLE ROW LEVEL SECURITY;',
  });
  assert.deepEqual(findTablesWithoutRls(dir), ["B"]);
});

test("every mirrored migration dir in the real repo passes", () => {
  const root = path.resolve(import.meta.dirname, "../..");
  for (const dir of MIGRATION_DIRS) {
    assert.deepEqual(findTablesWithoutRls(path.join(root, dir)), [], dir);
  }
});
