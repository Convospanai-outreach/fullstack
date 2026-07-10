import assert from "node:assert/strict";
import test from "node:test";

import { isCliEntrypoint, validateWorkflowSafety } from "./no-seed-readiness-audit.mjs";

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
