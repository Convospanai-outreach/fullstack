import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import process from "node:process";
import test from "node:test";

import { compareMigrationDirs, hashMigrationSql, listMigrationNames } from "./compare-prisma-schemas.mjs";

function makeMigrationTree(root, layout) {
  for (const [dirName, migrations] of Object.entries(layout)) {
    fs.mkdirSync(path.join(root, dirName), { recursive: true });
    for (const [migrationName, sql] of Object.entries(migrations)) {
      const migrationDir = path.join(root, dirName, migrationName);
      fs.mkdirSync(migrationDir, { recursive: true });
      fs.writeFileSync(path.join(migrationDir, "migration.sql"), sql);
    }
  }
}

// compareMigrationDirs/listMigrationNames/hashMigrationSql all resolve their
// paths against process.cwd() (captured once at module import time as
// repoRoot), so these tests chdir into a scratch tree that mirrors the
// packages/db + apps/web + apps/api layout, run the check, then restore cwd.
function withScratchRepo(layout, fn) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "prisma-drift-"));
  makeMigrationTree(root, layout);
  const originalCwd = process.cwd();
  process.chdir(root);
  try {
    return fn();
  } finally {
    process.chdir(originalCwd);
    fs.rmSync(root, { recursive: true, force: true });
  }
}

test("listMigrationNames returns only directory entries, sorted", () => {
  withScratchRepo(
    {
      "packages/db/prisma/migrations": { "20260101000000_b": "SELECT 1;", "20260101000000_a": "SELECT 1;" },
    },
    () => {
      const names = listMigrationNames("packages/db/prisma/migrations");
      assert.deepEqual(names, ["20260101000000_a", "20260101000000_b"]);
    },
  );
});

test("compareMigrationDirs reports MATCH when all three trees are identical", () => {
  const identicalSql = "ALTER TABLE \"Foo\" ADD COLUMN \"bar\" TEXT;\n";
  withScratchRepo(
    {
      "packages/db/prisma/migrations": { "20260101000000_init": identicalSql },
      "apps/web/prisma/migrations": { "20260101000000_init": identicalSql },
      "apps/api/prisma/migrations": { "20260101000000_init": identicalSql },
    },
    () => {
      const result = compareMigrationDirs();
      assert.equal(result.match, true);
      assert.equal(result.contentMismatches.length, 0);
    },
  );
});

test("compareMigrationDirs flags a migration folder missing from one copy", () => {
  const sql = "SELECT 1;\n";
  withScratchRepo(
    {
      "packages/db/prisma/migrations": {},
      "apps/web/prisma/migrations": { "20260101000000_init": sql },
      "apps/api/prisma/migrations": { "20260101000000_init": sql },
    },
    () => {
      const result = compareMigrationDirs();
      assert.equal(result.match, false);
      assert.equal(result.namesMatch, false);
      assert.deepEqual(result.sharedVsWeb.onlyRight, ["20260101000000_init"]);
    },
  );
});

test("compareMigrationDirs flags content that diverges between copies of the same migration name", () => {
  withScratchRepo(
    {
      "packages/db/prisma/migrations": { "20260101000000_init": "SELECT 1;\n" },
      "apps/web/prisma/migrations": { "20260101000000_init": "SELECT 1;\n" },
      "apps/api/prisma/migrations": { "20260101000000_init": "SELECT 2;\n" },
    },
    () => {
      const result = compareMigrationDirs();
      assert.equal(result.match, false);
      assert.equal(result.namesMatch, true);
      assert.equal(result.contentMismatches.length, 1);
      assert.equal(result.contentMismatches[0].name, "20260101000000_init");
    },
  );
});

test("hashMigrationSql normalizes line endings before hashing", () => {
  withScratchRepo(
    {
      "packages/db/prisma/migrations": { "20260101000000_init": "SELECT 1;\r\n" },
    },
    () => {
      const crlfHash = hashMigrationSql("packages/db/prisma/migrations", "20260101000000_init");
      fs.writeFileSync(
        path.join(process.cwd(), "packages/db/prisma/migrations/20260101000000_init/migration.sql"),
        "SELECT 1;\n",
      );
      const lfHash = hashMigrationSql("packages/db/prisma/migrations", "20260101000000_init");
      assert.equal(crlfHash, lfHash);
    },
  );
});
