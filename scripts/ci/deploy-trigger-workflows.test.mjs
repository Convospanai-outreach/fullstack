import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";

import yaml from "js-yaml";

// deploy-oracle.yml runs only after the workflows it lists under workflow_run
// complete, so every job in them delays (or, on failure, blocks) the API
// deploy. An emulated arm64 build in one of them held up the f35cc9a deploy
// by ~85 minutes; the Pi5 image now builds in its own workflow.

const workflowsDir = path.resolve(import.meta.dirname, "../../.github/workflows");

function loadWorkflows() {
  return fs
    .readdirSync(workflowsDir)
    .filter((file) => /\.ya?ml$/.test(file))
    .map((file) => ({ file, doc: yaml.load(fs.readFileSync(path.join(workflowsDir, file), "utf8")) }));
}

function deployTriggerWorkflows(workflows) {
  const deploy = workflows.find((w) => w.file === "deploy-oracle.yml");
  assert.ok(deploy, "deploy-oracle.yml exists");
  const names = deploy.doc.on?.workflow_run?.workflows ?? [];
  assert.ok(names.length > 0, "deploy-oracle.yml is triggered by workflow_run");
  return names.map((name) => {
    const match = workflows.find((w) => w.doc?.name === name);
    assert.ok(match, `a workflow named "${name}" exists`);
    return match;
  });
}

function isEmulatedStep(step) {
  const uses = step.uses ?? "";
  const platforms = String(step.with?.platforms ?? "");
  return uses.startsWith("docker/setup-qemu-action") || /arm64|arm\/v/.test(platforms);
}

test("workflows that trigger the Oracle deploy run no emulated (QEMU/arm64) builds", () => {
  for (const { file, doc } of deployTriggerWorkflows(loadWorkflows())) {
    for (const [jobId, job] of Object.entries(doc.jobs ?? {})) {
      const emulated = (job.steps ?? []).filter(isEmulatedStep).map((s) => s.name ?? s.uses);
      assert.deepEqual(emulated, [], `${file} job "${jobId}" runs emulated steps that would delay the deploy`);
    }
  }
});

test("the Pi5 image still has a workflow, and it does not trigger the deploy", () => {
  const workflows = loadWorkflows();
  const pi5 = workflows.find((w) => w.file === "docker-ghcr-edge-pi5.yml");
  assert.ok(pi5, "docker-ghcr-edge-pi5.yml exists");
  assert.ok(pi5.doc.jobs["build-and-push-edge-pi5"], "it defines build-and-push-edge-pi5");
  const triggers = deployTriggerWorkflows(workflows).map((w) => w.file);
  assert.ok(!triggers.includes(pi5.file), "deploy-oracle.yml does not wait on the Pi5 workflow");
});
