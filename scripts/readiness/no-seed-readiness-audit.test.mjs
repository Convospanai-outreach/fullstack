import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";

import {
  executeAudit,
  isCliEntrypoint,
  runAudit,
  safeReadRequiredFile,
  validateWorkflowSafety,
} from "./no-seed-readiness-audit.mjs";

function workflowState({
  overallStatus = "FUNCTIONAL_PAGE_LOAD_SMOKE_PASS / WRITE_WORKFLOWS_PENDING / STAGE_12A_BLOCKED_HIGH",
  productReadiness = "FUNCTIONAL_PAGE_LOAD_SMOKE_PASS / WRITE_WORKFLOWS_PENDING / STAGE_12A_BLOCKED_HIGH",
  pr6 = "BLOCKED",
  productionMigration = "NOT_APPROVED",
  productionDataMutation = "NOT_APPROVED",
  stage12A = "BLOCKED",
  stage12B = "VAPT_SCOPE_READY",
} = {}) {
  return `# Codex Workflow State

## Current status

| Field | Value |
| --- | --- |
| Overall status | ${overallStatus} |
| Overall product readiness | ${productReadiness} |
| Production migration status | ${productionMigration} |
| Production data mutation approval | ${productionDataMutation} |
| PR #6 status | ${pr6} |

## Stage tracker

| Stage | Agent | Status | Evidence file | Notes |
| --- | --- | --- | --- | --- |
| 12A. Minimum security gate for controlled beta | security-hardening-agent | ${stage12A} | docs/audits/stage-12a-minimum-security-gate-2026-07-10.md | High findings remain open. |
| 12B. Deep security hardening for public/enterprise production | security-hardening-agent | ${stage12B} | docs/audits/stage-12b-vapt-scope-2026-07-10.md | VAPT has not started. |
`;
}

function failedCheckNames(result) {
  return result.checks
    .filter((check) => check.status === "FAIL")
    .map((check) => check.name);
}

test("current Stage 12A blocked status passes", () => {
  const result = validateWorkflowSafety(workflowState());
  assert.equal(result.passed, true, failedCheckNames(result).join(", "));
});

test("historical NEEDS_REPLAN and NOT_READY status passes", () => {
  const result = validateWorkflowSafety(
    workflowState({
      overallStatus: "NEEDS_REPLAN",
      productReadiness: "NOT_READY",
      stage12A: "NEEDS_REPLAN",
      stage12B: "NEEDS_REPLAN",
    })
  );
  assert.equal(result.passed, true, failedCheckNames(result).join(", "));
});

test("documented blocked and in-progress non-ready statuses pass", () => {
  for (const status of ["IN_PROGRESS", "NEEDS_INPUT", "BLOCKED_BY_FAILED_TESTS", "RED / NEEDS_REPLAN"]) {
    const result = validateWorkflowSafety(
      workflowState({
        overallStatus: status,
        productReadiness: status,
      })
    );
    assert.equal(result.passed, true, `${status}: ${failedCheckNames(result).join(", ")}`);
  }
});

test("CONTROLLED_BETA_READY with Stage 12A blocked fails", () => {
  const result = validateWorkflowSafety(
    workflowState({
      overallStatus: "CONTROLLED_BETA_READY",
      productReadiness: "CONTROLLED_BETA_READY",
      stage12A: "BLOCKED",
    })
  );
  assert.equal(result.passed, false);
  assert.ok(failedCheckNames(result).includes("Overall status remains safely non-ready"));
});

test("PRODUCTION_READY with Stage 12B incomplete fails", () => {
  const result = validateWorkflowSafety(
    workflowState({
      overallStatus: "PRODUCTION_READY",
      productReadiness: "PRODUCTION_READY",
      stage12A: "BLOCKED",
      stage12B: "VAPT_SCOPE_READY",
    })
  );
  assert.equal(result.passed, false);
  assert.ok(failedCheckNames(result).includes("Overall product readiness remains safely non-ready"));
});

test("ready-ish workflow vocabulary does not pass overall readiness", () => {
  for (const status of ["READY_FOR_NEXT_STAGE", "PASS", "COMPLETE"]) {
    const result = validateWorkflowSafety(
      workflowState({
        overallStatus: status,
        productReadiness: status,
      })
    );
    assert.equal(result.passed, false, status);
  }
});

test("PR #6 unblocked fails", () => {
  const result = validateWorkflowSafety(workflowState({ pr6: "READY_FOR_NEXT_STAGE" }));
  assert.equal(result.passed, false);
  assert.ok(failedCheckNames(result).includes("PR #6 remains blocked"));
});

test("production migration approved fails", () => {
  const result = validateWorkflowSafety(workflowState({ productionMigration: "APPROVED" }));
  assert.equal(result.passed, false);
  assert.ok(failedCheckNames(result).includes("Production migration remains not approved"));
});

test("production data mutation approved fails", () => {
  const result = validateWorkflowSafety(workflowState({ productionDataMutation: "APPROVED" }));
  assert.equal(result.passed, false);
  assert.ok(failedCheckNames(result).includes("Production data mutation remains not approved"));
});

test("CLI entrypoint check accepts relative npm script path", () => {
  assert.equal(isCliEntrypoint("scripts/readiness/no-seed-readiness-audit.mjs"), true);
  assert.equal(isCliEntrypoint("scripts/readiness/other.mjs"), false);
});


const SIDE_EFFECT_FIELDS = [
  "db_access",
  "sql_execution",
  "seed_execution",
  "secret_access",
  "migration_execution",
];

function writeFixtureFile(root, relativePath, contents) {
  const fullPath = path.join(root, relativePath);
  fs.mkdirSync(path.dirname(fullPath), { recursive: true });
  fs.writeFileSync(fullPath, contents, "utf8");
}

function createAuditFixture(t) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "readiness-audit-"));
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));

  writeFixtureFile(root, "scripts/readiness/no-seed-readiness-audit.mjs", "// file-only readiness audit fixture\n");
  writeFixtureFile(
    root,
    "package.json",
    JSON.stringify({
      scripts: {
        "readiness:audit:no-seed": "node scripts/readiness/no-seed-readiness-audit.mjs",
      },
    })
  );
  writeFixtureFile(
    root,
    "docs/runbooks/read-only-live-db-proof-2026-07-07.md",
    [
      "Read-only live DB proof remains NOT_RUN / PENDING.",
      "EdgeNode `DELETE` remains RED until proof exists.",
      "PR #6 remains blocked.",
    ].join("\n")
  );
  writeFixtureFile(
    root,
    "docs/templates/read-only-live-db-proof-evidence-2026-07-07.md",
    "- Status: NOT_RUN / PASS / FAIL / BLOCKED"
  );
  writeFixtureFile(root, "docs/codex/WORKFLOW_STATE.md", workflowState());
  writeFixtureFile(
    root,
    "docs/codex/VERIFICATION_MATRIX.md",
    [
      "## No-seed readiness audit mode (2026-07-07)",
      "FUNCTIONAL_PAGE_LOAD_SMOKE_PASS / WRITE_WORKFLOWS_PENDING / STAGE_12A_BLOCKED_HIGH",
    ].join("\n")
  );
  writeFixtureFile(root, "scripts/readiness/scan-destructive-migrations.ts", "// fixture\n");
  return root;
}

function assertNoSideEffects(summary) {
  for (const field of SIDE_EFFECT_FIELDS) {
    assert.equal(summary[field], "NOT_ATTEMPTED", field);
  }
}

function hasFailedCheck(summary, name) {
  return summary.checks.some((check) => check.name === name && check.status === "FAIL");
}

function failingReaderFor(relativePath, errorCode = "EACCES") {
  const suffix = path.normalize(relativePath);
  return (fullPath, encoding) => {
    if (path.normalize(fullPath).endsWith(suffix)) {
      const error = new Error("internal filesystem detail must not escape");
      error.code = errorCode;
      throw error;
    }
    return fs.readFileSync(fullPath, encoding);
  };
}

test("successful fixture audit returns PASS", (t) => {
  const root = createAuditFixture(t);
  const result = runAudit({ repositoryRoot: root });
  assert.equal(result.exitCode, 0);
  assert.equal(result.summary.audit_status, "PASS");
  assertNoSideEffects(result.summary);
});

test("missing WORKFLOW_STATE.md emits controlled structured CLI failure", (t) => {
  const root = createAuditFixture(t);
  fs.rmSync(path.join(root, "docs/codex/WORKFLOW_STATE.md"));

  let output = "";
  let exitCode;
  const result = executeAudit({
    args: ["--json"],
    repositoryRoot: root,
    writeOutput: (value) => {
      output = value;
    },
    exit: (code) => {
      exitCode = code;
    },
  });

  const summary = JSON.parse(output);
  assert.equal(exitCode, 1);
  assert.equal(result.exitCode, 1);
  assert.equal(summary.audit_status, "FAIL");
  assert.ok(hasFailedCheck(summary, "Workflow state doc exists"));
  assert.ok(hasFailedCheck(summary, "Workflow state is readable for safety validation"));
  assert.doesNotMatch(output, /internal filesystem detail|\n\s+at\s/);
  assertNoSideEffects(summary);
});

test("unreadable WORKFLOW_STATE.md is a governed failure", (t) => {
  const root = createAuditFixture(t);
  const result = runAudit({
    repositoryRoot: root,
    fileReader: failingReaderFor("docs/codex/WORKFLOW_STATE.md"),
  });

  assert.equal(result.exitCode, 1);
  assert.equal(result.summary.audit_status, "FAIL");
  assert.ok(hasFailedCheck(result.summary, "Workflow state is readable for safety validation"));
  assert.equal(
    result.summary.checks.some((check) => check.detail.includes("internal filesystem detail")),
    false
  );
  assertNoSideEffects(result.summary);
});

test("missing assertContains input is a governed failure", (t) => {
  const root = createAuditFixture(t);
  fs.rmSync(path.join(root, "docs/templates/read-only-live-db-proof-evidence-2026-07-07.md"));

  const result = runAudit({ repositoryRoot: root });
  assert.equal(result.exitCode, 1);
  assert.equal(result.summary.audit_status, "FAIL");
  assert.ok(hasFailedCheck(result.summary, "Evidence template preserves execution states"));
  assertNoSideEffects(result.summary);
});

test("unreadable assertContains input is a governed failure", (t) => {
  const root = createAuditFixture(t);
  const result = runAudit({
    repositoryRoot: root,
    fileReader: failingReaderFor(
      "docs/templates/read-only-live-db-proof-evidence-2026-07-07.md",
      "EPERM"
    ),
  });

  assert.equal(result.exitCode, 1);
  assert.equal(result.summary.audit_status, "FAIL");
  assert.ok(hasFailedCheck(result.summary, "Evidence template preserves execution states"));
  assertNoSideEffects(result.summary);
});

test("missing package.json is a governed failure", (t) => {
  const root = createAuditFixture(t);
  fs.rmSync(path.join(root, "package.json"));

  const result = runAudit({ repositoryRoot: root });
  assert.equal(result.exitCode, 1);
  assert.equal(result.summary.audit_status, "FAIL");
  assert.ok(hasFailedCheck(result.summary, "Root package.json is readable"));
  assert.ok(hasFailedCheck(result.summary, "No-seed audit script alias exists"));
  assertNoSideEffects(result.summary);
});

test("malformed package.json is a governed failure", (t) => {
  const root = createAuditFixture(t);
  writeFixtureFile(root, "package.json", "{ malformed");

  const result = runAudit({ repositoryRoot: root });
  assert.equal(result.exitCode, 1);
  assert.equal(result.summary.audit_status, "FAIL");
  assert.ok(hasFailedCheck(result.summary, "Root package.json is valid JSON"));
  assert.ok(hasFailedCheck(result.summary, "No-seed audit script alias exists"));
  assertNoSideEffects(result.summary);
});

test("safe reader reports other filesystem errors without leaking internals", (t) => {
  const root = createAuditFixture(t);
  const result = safeReadRequiredFile("package.json", {
    repositoryRoot: root,
    fileReader: failingReaderFor("package.json", "EIO"),
  });

  assert.deepEqual(result, {
    ok: false,
    path: "package.json",
    errorCode: "FILE_READ_ERROR",
    errorMessage: "required file could not be read",
  });
});

test("one successful check cannot turn a governed failure into PASS", (t) => {
  const root = createAuditFixture(t);
  fs.rmSync(path.join(root, "docs/codex/VERIFICATION_MATRIX.md"));

  const result = runAudit({ repositoryRoot: root });
  assert.equal(result.exitCode, 1);
  assert.equal(result.summary.audit_status, "FAIL");
  assert.ok(result.summary.checks.some((check) => check.status === "PASS"));
  assert.ok(result.summary.checks.some((check) => check.status === "FAIL"));
  assertNoSideEffects(result.summary);
});

test("unsafe CLI flags remain refused with no side effects", () => {
  let output = "";
  let exitCode;
  executeAudit({
    args: ["--db"],
    writeOutput: (value) => {
      output = value;
    },
    exit: (code) => {
      exitCode = code;
    },
  });

  const summary = JSON.parse(output);
  assert.equal(exitCode, 1);
  assert.equal(summary.audit_status, "REFUSED_UNSAFE_FLAGS");
  assertNoSideEffects(summary);
});


test("filesystem existence-check errors are governed", (t) => {
  const root = createAuditFixture(t);
  const result = runAudit({
    repositoryRoot: root,
    fileExists: () => {
      throw new Error("internal existence-check detail must not escape");
    },
  });

  assert.equal(result.exitCode, 1);
  assert.equal(result.summary.audit_status, "FAIL");
  assert.ok(hasFailedCheck(result.summary, "Workflow state doc exists"));
  assert.equal(
    result.summary.checks.some((check) =>
      check.detail.includes("internal existence-check detail")
    ),
    false
  );
  assertNoSideEffects(result.summary);
});
