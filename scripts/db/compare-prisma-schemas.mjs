import { createHash } from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);

// A function, not a cached constant: reading process.cwd() fresh on every
// call (rather than once at module import) is what lets tests chdir into a
// scratch tree and have that observed - behaviorally identical in normal
// use, since a real invocation's cwd never changes mid-process.
function repoRoot() {
  return process.cwd();
}

const schemaPaths = [
  "packages/db/prisma/schema.prisma",
  "apps/web/prisma/schema.prisma",
  "apps/api/prisma/schema.prisma",
];

// The three schemas above are meant to be kept as identical copies (see
// packages/db/README.md), and so are their migration directories - a
// migration added under one and not mirrored to the others (the exact drift
// OPEN-239/I-03 found: apps/api had 20260915120000_agent_team_scope while
// apps/web and packages/db didn't) would otherwise go unnoticed, since this
// script previously only compared schema.prisma content.
const migrationDirPaths = [
  "packages/db/prisma/migrations",
  "apps/web/prisma/migrations",
  "apps/api/prisma/migrations",
];

export function listMigrationNames(relativeDirPath) {
  const absoluteDirPath = path.resolve(repoRoot(), relativeDirPath);
  return fs
    .readdirSync(absoluteDirPath, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => entry.name)
    .sort((a, b) => a.localeCompare(b));
}

export function hashMigrationSql(relativeDirPath, migrationName) {
  const absolutePath = path.resolve(repoRoot(), relativeDirPath, migrationName, "migration.sql");
  const rawContent = fs.readFileSync(absolutePath, "utf8");
  return createHash("sha256").update(normalizeLineEndings(rawContent)).digest("hex");
}

function readSchema(relativePath) {
  const absolutePath = path.resolve(repoRoot(), relativePath);
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

export function compareMigrationDirs() {
  const [sharedDir, webDir, apiDir] = migrationDirPaths;
  const sharedNames = listMigrationNames(sharedDir);
  const webNames = listMigrationNames(webDir);
  const apiNames = listMigrationNames(apiDir);

  const sharedVsWeb = compareLists(sharedNames, webNames);
  const sharedVsApi = compareLists(sharedNames, apiNames);
  const webVsApi = compareLists(webNames, apiNames);
  const namesMatch =
    sharedVsWeb.onlyLeft.length === 0 &&
    sharedVsWeb.onlyRight.length === 0 &&
    sharedVsApi.onlyLeft.length === 0 &&
    sharedVsApi.onlyRight.length === 0 &&
    webVsApi.onlyLeft.length === 0 &&
    webVsApi.onlyRight.length === 0;

  const commonNames = sharedNames.filter(
    (name) => webNames.includes(name) && apiNames.includes(name),
  );
  const contentMismatches = [];
  for (const name of commonNames) {
    const sharedHash = hashMigrationSql(sharedDir, name);
    const webHash = hashMigrationSql(webDir, name);
    const apiHash = hashMigrationSql(apiDir, name);
    if (sharedHash !== webHash || sharedHash !== apiHash) {
      contentMismatches.push({ name, sharedHash, webHash, apiHash });
    }
  }

  return {
    namesMatch,
    sharedVsWeb,
    sharedVsApi,
    webVsApi,
    contentMismatches,
    match: namesMatch && contentMismatches.length === 0,
  };
}

function reportMigrationDirs(result) {
  console.log("\nPrisma migration directory comparison");
  console.log(`- packages/db vs apps/web (folder names): ${result.sharedVsWeb.onlyLeft.length === 0 && result.sharedVsWeb.onlyRight.length === 0 ? "MATCH" : "DIFFER"}`);
  if (result.sharedVsWeb.onlyLeft.length) console.log(`  only in packages/db: ${result.sharedVsWeb.onlyLeft.join(", ")}`);
  if (result.sharedVsWeb.onlyRight.length) console.log(`  only in apps/web: ${result.sharedVsWeb.onlyRight.join(", ")}`);

  console.log(`- packages/db vs apps/api (folder names): ${result.sharedVsApi.onlyLeft.length === 0 && result.sharedVsApi.onlyRight.length === 0 ? "MATCH" : "DIFFER"}`);
  if (result.sharedVsApi.onlyLeft.length) console.log(`  only in packages/db: ${result.sharedVsApi.onlyLeft.join(", ")}`);
  if (result.sharedVsApi.onlyRight.length) console.log(`  only in apps/api: ${result.sharedVsApi.onlyRight.join(", ")}`);

  console.log(`- apps/web vs apps/api (folder names): ${result.webVsApi.onlyLeft.length === 0 && result.webVsApi.onlyRight.length === 0 ? "MATCH" : "DIFFER"}`);
  if (result.webVsApi.onlyLeft.length) console.log(`  only in apps/web: ${result.webVsApi.onlyLeft.join(", ")}`);
  if (result.webVsApi.onlyRight.length) console.log(`  only in apps/api: ${result.webVsApi.onlyRight.join(", ")}`);

  if (result.contentMismatches.length === 0) {
    console.log("- migration.sql content (shared migrations): MATCH");
  } else {
    console.log("- migration.sql content (shared migrations): DIFFER");
    for (const mismatch of result.contentMismatches) {
      console.log(`  ${mismatch.name}: packages/db=${mismatch.sharedHash} apps/web=${mismatch.webHash} apps/api=${mismatch.apiHash}`);
    }
  }
}

export function main() {
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

  const migrationDirResult = compareMigrationDirs();
  reportMigrationDirs(migrationDirResult);
  console.log(`- migration directories: ${migrationDirResult.match ? "MATCH" : "DIFFER"}`);

  if (!sharedMatchesWeb || !sharedMatchesApi || !webMatchesApi || !migrationDirResult.match) {
    process.exitCode = 1;
  }
}

export function isCliEntrypoint(argvPath = process.argv[1]) {
  return Boolean(argvPath) && path.resolve(argvPath) === __filename;
}

if (isCliEntrypoint()) {
  main();
}
