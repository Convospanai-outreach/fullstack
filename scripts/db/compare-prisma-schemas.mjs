import { createHash } from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import process from "node:process";

const repoRoot = process.cwd();

const schemaPaths = [
  "packages/db/prisma/schema.prisma",
  "apps/web/prisma/schema.prisma",
  "apps/api/prisma/schema.prisma",
];

function readSchema(relativePath) {
  const absolutePath = path.resolve(repoRoot, relativePath);
  const rawContent = fs.readFileSync(absolutePath, "utf8");
  const content = normalizeLineEndings(rawContent);
  const semanticContent = normalizeSafeWhitespace(content);
  return {
    relativePath,
    content,
    semanticContent,
    hash: createHash("sha256").update(content).digest("hex"),
    semanticHash: createHash("sha256").update(semanticContent).digest("hex"),
    lines: content.split("\n").length,
  };
}

function normalizeLineEndings(content) {
  return content.replace(/\r\n/g, "\n").replace(/\r/g, "\n");
}

function normalizeSafeWhitespace(content) {
  return normalizeLineEndings(content)
    .split("\n")
    .map((line) => line.trimEnd())
    .join("\n")
    .replace(/\n+$/u, "\n");
}

function extractBlockNames(content, keyword) {
  const pattern = new RegExp(`^\\s*${keyword}\\s+([A-Za-z0-9_]+)\\s*{`, "gm");
  const names = [];
  let match;
  while ((match = pattern.exec(content)) !== null) {
    names.push(match[1]);
  }
  return names.sort((a, b) => a.localeCompare(b));
}

function compareLists(left, right) {
  const rightSet = new Set(right);
  const leftSet = new Set(left);
  return {
    onlyLeft: left.filter((item) => !rightSet.has(item)),
    onlyRight: right.filter((item) => !leftSet.has(item)),
  };
}

function reportPair(left, right) {
  const same = left.semanticContent === right.semanticContent;
  console.log(`\n${left.relativePath} <-> ${right.relativePath}`);
  console.log(`  status: ${same ? "MATCH" : "DIFFER"}`);
  console.log(`  left sha256:  ${left.hash}`);
  console.log(`  right sha256: ${right.hash}`);
  if (left.hash !== right.hash && same) {
    console.log("  note: raw files differ only by safe whitespace normalization");
  }
  if (!same) {
    console.log(`  left semantic sha256:  ${left.semanticHash}`);
    console.log(`  right semantic sha256: ${right.semanticHash}`);
  }

  const leftModels = extractBlockNames(left.content, "model");
  const rightModels = extractBlockNames(right.content, "model");
  const leftEnums = extractBlockNames(left.content, "enum");
  const rightEnums = extractBlockNames(right.content, "enum");
  const modelDiff = compareLists(leftModels, rightModels);
  const enumDiff = compareLists(leftEnums, rightEnums);

  if (modelDiff.onlyLeft.length || modelDiff.onlyRight.length) {
    console.log(`  models only in left: ${modelDiff.onlyLeft.join(", ") || "none"}`);
    console.log(`  models only in right: ${modelDiff.onlyRight.join(", ") || "none"}`);
  }

  if (enumDiff.onlyLeft.length || enumDiff.onlyRight.length) {
    console.log(`  enums only in left: ${enumDiff.onlyLeft.join(", ") || "none"}`);
    console.log(`  enums only in right: ${enumDiff.onlyRight.join(", ") || "none"}`);
  }

  return same;
}

function main() {
  const schemas = schemaPaths.map(readSchema);
  const [shared, web, api] = schemas;

  console.log("Prisma schema comparison");
  for (const schema of schemas) {
    console.log(`- ${schema.relativePath}: ${schema.lines} lines, sha256=${schema.hash}`);
  }

  const sharedMatchesWeb = reportPair(shared, web);
  const sharedMatchesApi = reportPair(shared, api);
  const webMatchesApi = reportPair(web, api);

  console.log("\nSummary");
  console.log(`- shared vs web: ${sharedMatchesWeb ? "MATCH" : "DIFFER"}`);
  console.log(`- shared vs api: ${sharedMatchesApi ? "MATCH" : "DIFFER"}`);
  console.log(`- web vs api: ${webMatchesApi ? "MATCH" : "DIFFER"}`);

  if (!sharedMatchesWeb || !sharedMatchesApi || !webMatchesApi) {
    process.exitCode = 1;
  }
}

main();
