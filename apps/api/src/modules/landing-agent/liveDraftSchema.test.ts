import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

// Phase 2 (live draft): LandingPage gets two draft columns. The three Prisma copies and the
// migration folder must match (rule: compare-prisma-schemas.mjs).
const REPO = resolve(__dirname, "../../../../..");
const MIGRATION = "20261101100000_landing_page_draft_columns";
const SCHEMAS = [
  "apps/api/prisma/schema.prisma",
  "apps/web/prisma/schema.prisma",
  "packages/db/prisma/schema.prisma",
];
const MIGRATION_DIRS = [
  "apps/api/prisma/migrations",
  "apps/web/prisma/migrations",
  "packages/db/prisma/migrations",
];

function landingPageBlock(schema: string): string {
  const match = /model LandingPage \{[\s\S]*?\n\}/.exec(schema);
  if (!match) throw new Error("model LandingPage not found");
  return match[0];
}

describe("live draft columns on LandingPage", () => {
  it.each(SCHEMAS)("%s declares draftRenderedJson and draftEditorState as nullable Json", (rel) => {
    const block = landingPageBlock(readFileSync(resolve(REPO, rel), "utf8"));
    expect(block).toMatch(/\bdraftRenderedJson\s+Json\?/);
    expect(block).toMatch(/\bdraftEditorState\s+Json\?/);
  });

  it.each(MIGRATION_DIRS)("%s has the migration folder", (dir) => {
    expect(existsSync(resolve(REPO, dir, MIGRATION, "migration.sql"))).toBe(true);
  });

  it("the migration SQL is identical in all three copies and guards the Landing table", () => {
    const sql = MIGRATION_DIRS.map((dir) =>
      readFileSync(resolve(REPO, dir, MIGRATION, "migration.sql"), "utf8").replace(/\r\n/g, "\n"),
    );
    expect(sql[1]).toBe(sql[0]);
    expect(sql[2]).toBe(sql[0]);
    expect(sql[0]).toContain('ALTER TABLE IF EXISTS "LandingPage"');
    expect(sql[0]).toContain('ADD COLUMN IF NOT EXISTS "draftRenderedJson" JSONB');
    expect(sql[0]).toContain('ADD COLUMN IF NOT EXISTS "draftEditorState" JSONB');
  });
});
