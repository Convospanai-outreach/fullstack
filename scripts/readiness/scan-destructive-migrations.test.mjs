import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";

import {
  loadAllowlist,
  parseFilesFilter,
  scanFile,
} from "./scan-destructive-migrations.ts";

test("parseFilesFilter returns undefined when --files is absent (full-history scan mode)", () => {
  assert.equal(parseFilesFilter([]), undefined);
  assert.equal(parseFilesFilter(["--allowlist=foo.json"]), undefined);
});

test("parseFilesFilter returns an empty array for --files= (nothing to scan)", () => {
  assert.deepEqual(parseFilesFilter(["--files="]), []);
});

test("parseFilesFilter splits, trims, and normalizes a comma-separated list", () => {
  assert.deepEqual(
    parseFilesFilter(["--files=apps/api/prisma/migrations/a/migration.sql, apps\\web\\prisma\\migrations\\b\\migration.sql"]),
    ["apps/api/prisma/migrations/a/migration.sql", "apps/web/prisma/migrations/b/migration.sql"],
  );
});

// scanFile resolves its filePath argument against the module's repoRoot
// (captured once at import time as process.cwd()), so a relative path here
// would resolve against the real repo root, not a temp dir. Passing an
// absolute path sidesteps that: path.resolve() returns an absolute input
// unchanged regardless of the base it's given.

test("scanFile flags a destructive pattern in an arbitrary (non-allowlisted) migration file", () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "destructive-scan-"));
  const absolutePath = path.join(dir, "sample-migration.sql");
  fs.writeFileSync(absolutePath, 'ALTER TABLE "Foo" DROP COLUMN "bar";\n');
  try {
    const findings = scanFile(absolutePath, []);
    assert.equal(findings.length, 1);
    assert.equal(findings[0].patternId, "DROP_COLUMN");
    assert.equal(findings[0].allowlisted, false);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test("scanFile treats an allowlisted finding as non-blocking", () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "destructive-scan-"));
  const absolutePath = path.join(dir, "sample-migration.sql");
  fs.writeFileSync(absolutePath, 'DROP TABLE "Foo";\n');
  try {
    const allowlist = [{ path: absolutePath, patternId: "DROP_TABLE", reason: "reviewed" }];
    const findings = scanFile(absolutePath, allowlist);
    assert.equal(findings.length, 1);
    assert.equal(findings[0].allowlisted, true);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test("loadAllowlist returns an empty array when the file does not exist", () => {
  assert.deepEqual(loadAllowlist("/definitely/does/not/exist.json"), []);
});
