// Copies packages/db/prisma/schema.prisma (the canonical source) over
// apps/web/prisma/schema.prisma and apps/api/prisma/schema.prisma, so the
// three byte-identical copies never have to be hand-edited in lockstep.
// Run `node scripts/db/compare-prisma-schemas.mjs` after to confirm a match.
import fs from "node:fs";
import path from "node:path";
import process from "node:process";

const repoRoot = process.cwd();
const sourcePath = "packages/db/prisma/schema.prisma";
const targetPaths = ["apps/web/prisma/schema.prisma", "apps/api/prisma/schema.prisma"];

function main() {
  const sourceAbsolute = path.resolve(repoRoot, sourcePath);
  const sourceContent = fs.readFileSync(sourceAbsolute, "utf8");

  for (const targetPath of targetPaths) {
    const targetAbsolute = path.resolve(repoRoot, targetPath);
    fs.writeFileSync(targetAbsolute, sourceContent);
    console.log(`synced ${sourcePath} -> ${targetPath}`);
  }
}

main();
