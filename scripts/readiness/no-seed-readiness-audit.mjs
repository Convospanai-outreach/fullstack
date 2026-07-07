import fs from "node:fs";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const repoRoot = path.resolve(__dirname, "..", "..");

const SCRIPT_PATH = "scripts/readiness/no-seed-readiness-audit.mjs";
const RUNBOOK_PATH = "docs/runbooks/read-only-live-db-proof-2026-07-07.md";
const TEMPLATE_PATH = "docs/templates/read-only-live-db-proof-evidence-2026-07-07.md";
const WORKFLOW_STATE_PATH = "docs/codex/WORKFLOW_STATE.md";
const VERIFICATION_MATRIX_PATH = "docs/codex/VERIFICATION_MATRIX.md";
const SCANNER_PATH = "scripts/readiness/scan-destructive-migrations.ts";
const PACKAGE_JSON_PATH = "package.json";

const allowedArgs = new Set(["--json"]);
const forbiddenArgPatterns = [
  /^--production(?:=|$)/,
  /^--staging(?:=|$)/,
  /^--preview(?:=|$)/,
  /^--seed(?:=|$)/,
  /^--migrate(?:=|$)/,
  /^--db(?:=|$)/,
  /^--database(?:=|$)/,
  /^--database-url(?:=|$)/,
  /^--sql(?:=|$)/,
  /^--secret(?:=|$)/,
  /^--env(?:=|$)/,
  /^--dotenv(?:=|$)/,
  /^--write(?:=|$)/,
  /^--allow-production(?:=|$)/,
  /^--allow-production-readonly(?:=|$)/,
];

const checks = [];

function addCheck(name, passed, detail) {
  checks.push({
    name,
    status: passed ? "PASS" : "FAIL",
    detail,
  });
}

function getSummaryBase() {
  return {
    audit_mode: "no-seed-readiness",
    db_access: "NOT_ATTEMPTED",
    sql_execution: "NOT_ATTEMPTED",
    seed_execution: "NOT_ATTEMPTED",
    secret_access: "NOT_ATTEMPTED",
    migration_execution: "NOT_ATTEMPTED",
    live_db_proof: "NOT_RUN / PENDING",
    edgenode_status: "RED",
    pr_6_status: "BLOCKED",
    production_readiness: "NOT_READY",
    db_migration_governance: "RED / NEEDS_REPLAN",
    verdict: "NOT_READY",
  };
}

function printAndExit(auditStatus, exitCode, extra = {}) {
  const summary = {
    ...getSummaryBase(),
    audit_status: auditStatus,
    checks,
    ...extra,
  };

  console.log(JSON.stringify(summary, null, 2));
  process.exit(exitCode);
}

function resolveRepoPath(relativePath) {
  return path.join(repoRoot, relativePath);
}

function readRepoFile(relativePath) {
  return fs.readFileSync(resolveRepoPath(relativePath), "utf8");
}

function assertFileExists(relativePath, label) {
  const exists = fs.existsSync(resolveRepoPath(relativePath));
  addCheck(label, exists, exists ? relativePath : `missing: ${relativePath}`);
  return exists;
}

function assertContains(relativePath, needle, label, successDetail) {
  const contents = readRepoFile(relativePath);
  const passed = contents.includes(needle);
  addCheck(label, passed, passed ? successDetail : `missing required text: ${needle}`);
  return passed;
}

function validateArgs() {
  const rawArgs = process.argv.slice(2);
  const unsupportedArgs = rawArgs.filter((arg) => !allowedArgs.has(arg));
  const unsafeArgs = rawArgs.filter((arg) => forbiddenArgPatterns.some((pattern) => pattern.test(arg)));

  if (unsafeArgs.length > 0 || unsupportedArgs.length > 0) {
    printAndExit("REFUSED_UNSAFE_FLAGS", 1, {
      refusal_reason:
        "Unsafe or unsupported flags were provided. This mode is file-only and refuses DB, seed, migration, env, secret, and production-targeted flags.",
      refused_args: [...new Set([...unsafeArgs, ...unsupportedArgs])],
    });
  }
}

function main() {
  validateArgs();

  assertFileExists(SCRIPT_PATH, "No-seed audit script exists");
  assertFileExists(PACKAGE_JSON_PATH, "Root package.json exists");
  assertFileExists(RUNBOOK_PATH, "Read-only live DB proof runbook exists");
  assertFileExists(TEMPLATE_PATH, "Read-only live DB proof evidence template exists");
  assertFileExists(WORKFLOW_STATE_PATH, "Workflow state doc exists");
  assertFileExists(VERIFICATION_MATRIX_PATH, "Verification matrix doc exists");
  assertFileExists(SCANNER_PATH, "Destructive migration scanner exists");

  const scriptSource = readRepoFile(SCRIPT_PATH);
  const packageJson = JSON.parse(readRepoFile(PACKAGE_JSON_PATH));

  const scriptAlias = packageJson.scripts?.["readiness:audit:no-seed"];
  addCheck(
    "No-seed audit script alias exists",
    scriptAlias === `node ${SCRIPT_PATH}`,
    scriptAlias === `node ${SCRIPT_PATH}`
      ? scriptAlias
      : `expected "node ${SCRIPT_PATH}", received ${JSON.stringify(scriptAlias)}`
  );

  const riskyPatterns = [
    { label: "dotenv import", pattern: /from\s+["']dotenv["']/ },
    {
      label: "secret-bearing DB env access",
      pattern: /process\.env\.(?:DATABASE_URL|SCHEMA_VERIFY_DATABASE_URL|DIRECT_URL)\b/,
    },
    { label: "prisma client usage", pattern: /\bprisma\b\s*(?:\.|\()/ },
    { label: "pg import", pattern: /from\s+["']pg["']/ },
  ];
  const detectedRisks = riskyPatterns
    .filter(({ pattern }) => pattern.test(scriptSource))
    .map(({ label }) => label);
  addCheck(
    "No-seed audit script is file-only",
    detectedRisks.length === 0,
    detectedRisks.length === 0
      ? "script inspects repository files only and does not reference DB clients, SQL helpers, or secret-bearing env keys"
      : `unexpected risky tokens found: ${detectedRisks.join(", ")}`
  );

  assertContains(
    RUNBOOK_PATH,
    "Read-only live DB proof remains NOT_RUN / PENDING.",
    "Live DB proof remains pending in runbook",
    "runbook keeps live DB proof at NOT_RUN / PENDING"
  );
  assertContains(
    RUNBOOK_PATH,
    "EdgeNode `DELETE` remains RED until proof exists.",
    "EdgeNode remains RED in runbook",
    "runbook preserves EdgeNode RED status"
  );
  assertContains(
    RUNBOOK_PATH,
    "PR #6 remains blocked.",
    "PR #6 remains blocked in runbook",
    "runbook preserves PR #6 blocked status"
  );
  assertContains(
    TEMPLATE_PATH,
    "- Status: NOT_RUN / PASS / FAIL / BLOCKED",
    "Evidence template preserves execution states",
    "template keeps NOT_RUN/PASS/FAIL/BLOCKED execution states"
  );
  assertContains(
    WORKFLOW_STATE_PATH,
    "| Overall status | NEEDS_REPLAN |",
    "Workflow state preserves RED / NEEDS_REPLAN governance",
    "workflow state keeps overall status at NEEDS_REPLAN"
  );
  assertContains(
    WORKFLOW_STATE_PATH,
    "| Overall product readiness | NOT_READY |",
    "Workflow state preserves NOT_READY product status",
    "workflow state keeps overall product readiness at NOT_READY"
  );
  assertContains(
    VERIFICATION_MATRIX_PATH,
    "## No-seed readiness audit mode (2026-07-07)",
    "Verification matrix records no-seed audit mode",
    "verification matrix includes the no-seed audit mode section"
  );

  const failedChecks = checks.filter((check) => check.status === "FAIL");
  printAndExit(
    failedChecks.length === 0 ? "PASS" : "FAIL",
    failedChecks.length === 0 ? 0 : 1,
    {
      checked_paths: [
        PACKAGE_JSON_PATH,
        SCRIPT_PATH,
        RUNBOOK_PATH,
        TEMPLATE_PATH,
        WORKFLOW_STATE_PATH,
        VERIFICATION_MATRIX_PATH,
        SCANNER_PATH,
      ],
    }
  );
}

main();
