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

const acceptedSafelyNonReadyStates = new Set([
  "NOT_STARTED",
  "IN_PROGRESS",
  "NEEDS_INPUT",
  "NEEDS_REPLAN",
  "BLOCKED_BY_SCHEMA_CONFLICT",
  "BLOCKED_BY_FAILED_TESTS",
  "NOT_READY",
  "RED / NEEDS_REPLAN",
  "BLOCKED_BY_RED_DESTRUCTIVE_MIGRATIONS",
  "FINAL_SMOKE_PENDING",
  "FUNCTIONAL_SMOKE_PASS / STAGE_12A_BLOCKED_HIGH",
  "FUNCTIONAL_SMOKE_PASS / STAGE_12A_NEEDS_VERIFICATION",
  "FUNCTIONAL_PAGE_LOAD_SMOKE_PASS / WRITE_WORKFLOWS_PENDING / STAGE_12A_BLOCKED_HIGH",
  "BLOCKED",
  "BLOCKED_EXTERNAL_ACCESS",
  "NOT_APPROVED",
  "NOT_RUN / PENDING",
  "PARTIAL",
  "SAFE_TO_TERMINATE / RETIRED_PENDING_CONFIRMATION",
  "NOT_ACTIVE_PRISMA_DB",
  "VAPT_SCOPE_READY",
]);

const explicitReadyStates = new Set([
  "READY_FOR_NEXT_STAGE",
  "PASS",
  "COMPLETE",
  "CONTROLLED_BETA_READY",
  "PRODUCTION_READY",
]);

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

function createAuditResult(auditStatus, exitCode, extra = {}) {
  return {
    exitCode,
    summary: {
      ...getSummaryBase(),
      audit_status: auditStatus,
      checks: [...checks],
      ...extra,
    },
  };
}

function printAndExit(
  result,
  { writeOutput = console.log, exit = process.exit } = {}
) {
  writeOutput(JSON.stringify(result.summary, null, 2));
  exit(result.exitCode);
  return result;
}

function resolveRepoPath(relativePath, repositoryRoot = repoRoot) {
  return path.join(repositoryRoot, relativePath);
}

function normalizeReadError(error) {
  if (error?.code === "ENOENT") {
    return {
      errorCode: "FILE_NOT_FOUND",
      errorMessage: "required file is missing",
    };
  }
  if (error?.code === "EACCES" || error?.code === "EPERM") {
    return {
      errorCode: "FILE_READ_DENIED",
      errorMessage: "required file could not be read",
    };
  }
  return {
    errorCode: "FILE_READ_ERROR",
    errorMessage: "required file could not be read",
  };
}

export function safeReadRequiredFile(
  relativePath,
  { repositoryRoot = repoRoot, fileReader = fs.readFileSync } = {}
) {
  try {
    const contents = fileReader(resolveRepoPath(relativePath, repositoryRoot), "utf8");
    if (typeof contents !== "string") {
      return {
        ok: false,
        path: relativePath,
        errorCode: "INVALID_FILE_CONTENT",
        errorMessage: "required file did not contain readable text",
      };
    }
    return {
      ok: true,
      contents,
    };
  } catch (error) {
    return {
      ok: false,
      path: relativePath,
      ...normalizeReadError(error),
    };
  }
}

function readFailureDetail(result) {
  return `${result.path}: ${result.errorCode} - ${result.errorMessage}`;
}

function splitMarkdownRow(line) {
  const trimmed = line.trim();
  if (!trimmed.startsWith("|") || !trimmed.endsWith("|")) {
    return [];
  }
  return trimmed
    .slice(1, -1)
    .split("|")
    .map((cell) => cell.trim());
}

function sectionLines(contents, heading) {
  const lines = contents.split(/\r?\n/);
  const start = lines.findIndex((line) => line.trim() === heading);
  if (start === -1) {
    return [];
  }
  const result = [];
  for (let index = start + 1; index < lines.length; index += 1) {
    const line = lines[index];
    if (line.startsWith("## ")) {
      break;
    }
    result.push(line);
  }
  return result;
}

export function parseWorkflowState(contents) {
  const currentStatus = {};
  for (const line of sectionLines(contents, "## Current status")) {
    const cells = splitMarkdownRow(line);
    if (cells.length === 2 && cells[0] !== "Field" && !/^[- ]+$/.test(cells[0])) {
      currentStatus[cells[0]] = cells[1];
    }
  }

  const stages = {};
  for (const line of sectionLines(contents, "## Stage tracker")) {
    const cells = splitMarkdownRow(line);
    if (cells.length >= 5 && cells[0] !== "Stage" && !/^[- ]+$/.test(cells[0])) {
      stages[cells[0]] = {
        agent: cells[1],
        status: cells[2],
        evidenceFile: cells[3],
        notes: cells[4],
      };
    }
  }

  const stage12A = Object.entries(stages).find(([stage]) => stage.startsWith("12A."));
  const stage12B = Object.entries(stages).find(([stage]) => stage.startsWith("12B."));

  return {
    currentStatus,
    stages,
    stage12AStatus: stage12A?.[1]?.status,
    stage12BStatus: stage12B?.[1]?.status,
  };
}

function addValidationCheck(results, name, passed, detail) {
  results.push({
    name,
    status: passed ? "PASS" : "FAIL",
    detail,
  });
}

function isAcceptedSafelyNonReady(value) {
  return acceptedSafelyNonReadyStates.has(value);
}

function isReadyState(value) {
  return explicitReadyStates.has(value);
}

export function isCliEntrypoint(argvPath = process.argv[1]) {
  return Boolean(argvPath) && path.resolve(argvPath) === __filename;
}

export function validateWorkflowSafety(contents) {
  const parsed = parseWorkflowState(contents);
  const fields = parsed.currentStatus;
  const results = [];

  const requiredFields = [
    "Overall status",
    "Overall product readiness",
    "PR #6 status",
    "Production migration status",
    "Production data mutation approval",
  ];
  for (const field of requiredFields) {
    addValidationCheck(
      results,
      `Workflow state field exists: ${field}`,
      Boolean(fields[field]),
      fields[field] ? `${field}: ${fields[field]}` : `missing field: ${field}`
    );
  }

  const overallStatus = fields["Overall status"];
  addValidationCheck(
    results,
    "Overall status remains safely non-ready",
    isAcceptedSafelyNonReady(overallStatus) && !isReadyState(overallStatus),
    overallStatus
      ? `overall status: ${overallStatus}`
      : "missing Overall status"
  );

  const productReadiness = fields["Overall product readiness"];
  addValidationCheck(
    results,
    "Overall product readiness remains safely non-ready",
    isAcceptedSafelyNonReady(productReadiness) && !isReadyState(productReadiness),
    productReadiness
      ? `overall product readiness: ${productReadiness}`
      : "missing Overall product readiness"
  );

  addValidationCheck(
    results,
    "PR #6 remains blocked",
    fields["PR #6 status"] === "BLOCKED",
    `PR #6 status: ${fields["PR #6 status"] ?? "missing"}`
  );
  addValidationCheck(
    results,
    "Production migration remains not approved",
    fields["Production migration status"] === "NOT_APPROVED",
    `Production migration status: ${fields["Production migration status"] ?? "missing"}`
  );
  addValidationCheck(
    results,
    "Production data mutation remains not approved",
    fields["Production data mutation approval"] === "NOT_APPROVED",
    `Production data mutation approval: ${fields["Production data mutation approval"] ?? "missing"}`
  );

  const stage12AStatus = parsed.stage12AStatus;
  addValidationCheck(
    results,
    "Stage 12A status is parsed",
    Boolean(stage12AStatus),
    stage12AStatus ? `Stage 12A status: ${stage12AStatus}` : "missing Stage 12A row"
  );
  addValidationCheck(
    results,
    "Stage 12A is not represented as passed while high findings remain",
    Boolean(stage12AStatus) &&
      isAcceptedSafelyNonReady(stage12AStatus) &&
      !["PASS", "COMPLETE", "READY_FOR_NEXT_STAGE", "CONTROLLED_BETA_READY"].includes(stage12AStatus),
    stage12AStatus
      ? `Stage 12A status: ${stage12AStatus}`
      : "missing Stage 12A row"
  );

  const stage12BStatus = parsed.stage12BStatus;
  addValidationCheck(
    results,
    "Stage 12B/VAPT is not represented as complete",
    !stage12BStatus || (isAcceptedSafelyNonReady(stage12BStatus) && !["PASS", "COMPLETE", "PRODUCTION_READY"].includes(stage12BStatus)),
    stage12BStatus ? `Stage 12B status: ${stage12BStatus}` : "Stage 12B row not present"
  );

  const passed = results.every((check) => check.status === "PASS");
  return {
    passed,
    checks: results,
    parsed: {
      overall_status: overallStatus,
      overall_product_readiness: productReadiness,
      pr_6_status: fields["PR #6 status"],
      production_migration_status: fields["Production migration status"],
      production_data_mutation_approval: fields["Production data mutation approval"],
      stage_12a_status: stage12AStatus ?? "NOT_FOUND",
      stage_12b_status: stage12BStatus ?? "NOT_FOUND",
    },
  };
}

function assertFileExists(
  relativePath,
  label,
  { repositoryRoot = repoRoot, fileExists = fs.existsSync } = {}
) {
  let exists = false;
  try {
    exists = fileExists(resolveRepoPath(relativePath, repositoryRoot));
  } catch {
    addCheck(label, false, `${relativePath}: FILE_CHECK_ERROR - required file could not be checked`);
    return false;
  }
  addCheck(label, exists, exists ? relativePath : `missing: ${relativePath}`);
  return exists;
}

export function assertContains(
  relativePath,
  needle,
  label,
  successDetail,
  { repositoryRoot = repoRoot, fileReader = fs.readFileSync } = {}
) {
  const readResult = safeReadRequiredFile(relativePath, {
    repositoryRoot,
    fileReader,
  });
  if (!readResult.ok) {
    addCheck(label, false, readFailureDetail(readResult));
    return false;
  }

  const passed = readResult.contents.includes(needle);
  addCheck(label, passed, passed ? successDetail : `missing required text: ${needle}`);
  return passed;
}

function validateArgs(rawArgs) {
  const unsupportedArgs = rawArgs.filter((arg) => !allowedArgs.has(arg));
  const unsafeArgs = rawArgs.filter((arg) =>
    forbiddenArgPatterns.some((pattern) => pattern.test(arg))
  );

  if (unsafeArgs.length === 0 && unsupportedArgs.length === 0) {
    return null;
  }

  return createAuditResult("REFUSED_UNSAFE_FLAGS", 1, {
    refusal_reason:
      "Unsafe or unsupported flags were provided. This mode is file-only and refuses DB, seed, migration, env, secret, and production-targeted flags.",
    refused_args: [...new Set([...unsafeArgs, ...unsupportedArgs])],
  });
}

function emptyWorkflowState() {
  return {
    overall_status: "NOT_FOUND",
    overall_product_readiness: "NOT_FOUND",
    pr_6_status: "NOT_FOUND",
    production_migration_status: "NOT_FOUND",
    production_data_mutation_approval: "NOT_FOUND",
    stage_12a_status: "NOT_FOUND",
    stage_12b_status: "NOT_FOUND",
  };
}

export function runAudit({
  repositoryRoot = repoRoot,
  fileReader = fs.readFileSync,
  fileExists = fs.existsSync,
} = {}) {
  checks.length = 0;
  const fileOptions = { repositoryRoot, fileReader };
  const existenceOptions = { repositoryRoot, fileExists };

  assertFileExists(SCRIPT_PATH, "No-seed audit script exists", existenceOptions);
  assertFileExists(PACKAGE_JSON_PATH, "Root package.json exists", existenceOptions);
  assertFileExists(RUNBOOK_PATH, "Read-only live DB proof runbook exists", existenceOptions);
  assertFileExists(TEMPLATE_PATH, "Read-only live DB proof evidence template exists", existenceOptions);
  assertFileExists(WORKFLOW_STATE_PATH, "Workflow state doc exists", existenceOptions);
  assertFileExists(VERIFICATION_MATRIX_PATH, "Verification matrix doc exists", existenceOptions);
  assertFileExists(SCANNER_PATH, "Destructive migration scanner exists", existenceOptions);

  const scriptRead = safeReadRequiredFile(SCRIPT_PATH, fileOptions);
  if (!scriptRead.ok) {
    addCheck("No-seed audit script is file-only", false, readFailureDetail(scriptRead));
  } else {
    const riskyPatterns = [
      { label: "dotenv import", pattern: /from\s+["']dotenv["']/ },
      { label: "environment access", pattern: /process\.env\b/ },
      { label: "prisma client usage", pattern: /\bprisma\b\s*(?:\.|\()/ },
      { label: "pg import", pattern: /from\s+["']pg["']/ },
    ];
    const detectedRisks = riskyPatterns
      .filter(({ pattern }) => pattern.test(scriptRead.contents))
      .map(({ label }) => label);
    addCheck(
      "No-seed audit script is file-only",
      detectedRisks.length === 0,
      detectedRisks.length === 0
        ? "script inspects repository files only and does not reference DB clients, SQL helpers, or secret-bearing env keys"
        : `unexpected risky tokens found: ${detectedRisks.join(", ")}`
    );
  }

  const packageRead = safeReadRequiredFile(PACKAGE_JSON_PATH, fileOptions);
  let packageJson = null;
  if (!packageRead.ok) {
    addCheck("Root package.json is readable", false, readFailureDetail(packageRead));
  } else {
    addCheck("Root package.json is readable", true, PACKAGE_JSON_PATH);
    try {
      packageJson = JSON.parse(packageRead.contents);
      addCheck("Root package.json is valid JSON", true, "package.json parsed successfully");
    } catch {
      addCheck(
        "Root package.json is valid JSON",
        false,
        "package.json contains malformed JSON"
      );
    }
  }

  const scriptAlias = packageJson?.scripts?.["readiness:audit:no-seed"];
  addCheck(
    "No-seed audit script alias exists",
    scriptAlias === `node ${SCRIPT_PATH}`,
    scriptAlias === `node ${SCRIPT_PATH}`
      ? scriptAlias
      : `expected "node ${SCRIPT_PATH}", received ${JSON.stringify(scriptAlias)}`
  );

  assertContains(
    RUNBOOK_PATH,
    "Read-only live DB proof remains NOT_RUN / PENDING.",
    "Live DB proof remains pending in runbook",
    "runbook keeps live DB proof at NOT_RUN / PENDING",
    fileOptions
  );
  assertContains(
    RUNBOOK_PATH,
    "EdgeNode `DELETE` remains RED until proof exists.",
    "EdgeNode remains RED in runbook",
    "runbook preserves EdgeNode RED status",
    fileOptions
  );
  assertContains(
    RUNBOOK_PATH,
    "PR #6 remains blocked.",
    "PR #6 remains blocked in runbook",
    "runbook preserves PR #6 blocked status",
    fileOptions
  );
  assertContains(
    TEMPLATE_PATH,
    "- Status: NOT_RUN / PASS / FAIL / BLOCKED",
    "Evidence template preserves execution states",
    "template keeps NOT_RUN/PASS/FAIL/BLOCKED execution states",
    fileOptions
  );
  assertContains(
    VERIFICATION_MATRIX_PATH,
    "## No-seed readiness audit mode (2026-07-07)",
    "Verification matrix records no-seed audit mode",
    "verification matrix includes the no-seed audit mode section",
    fileOptions
  );

  let workflowState = emptyWorkflowState();
  const workflowRead = safeReadRequiredFile(WORKFLOW_STATE_PATH, fileOptions);
  if (!workflowRead.ok) {
    addCheck(
      "Workflow state is readable for safety validation",
      false,
      readFailureDetail(workflowRead)
    );
  } else {
    const workflowSafety = validateWorkflowSafety(workflowRead.contents);
    checks.push(...workflowSafety.checks);
    workflowState = workflowSafety.parsed;
  }

  assertContains(
    VERIFICATION_MATRIX_PATH,
    "FUNCTIONAL_PAGE_LOAD_SMOKE_PASS / WRITE_WORKFLOWS_PENDING / STAGE_12A_BLOCKED_HIGH",
    "Verification matrix records reconciled Stage 12A readiness label",
    "verification matrix distinguishes page-load smoke from write workflow readiness",
    fileOptions
  );

  const failedChecks = checks.filter((check) => check.status === "FAIL");
  return createAuditResult(
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
      workflow_state: workflowState,
    }
  );
}

export function executeAudit({
  args = process.argv.slice(2),
  repositoryRoot = repoRoot,
  fileReader = fs.readFileSync,
  fileExists = fs.existsSync,
  writeOutput = console.log,
  exit = process.exit,
} = {}) {
  checks.length = 0;
  const refusedResult = validateArgs(args);
  if (refusedResult) {
    return printAndExit(refusedResult, { writeOutput, exit });
  }

  const result = runAudit({ repositoryRoot, fileReader, fileExists });
  return printAndExit(result, { writeOutput, exit });
}

if (isCliEntrypoint()) {
  executeAudit();
}
