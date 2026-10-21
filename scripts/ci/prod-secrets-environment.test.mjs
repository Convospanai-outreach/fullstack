import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";

import yaml from "js-yaml";

// The production database URLs and the SSH key for the Oracle VMs live in GitHub environments
// (production-deploy: main only; production-migrate: needs a reviewer's approval), not as bare
// repository secrets. A job only gets that protection if it declares the environment, so any job
// that reads one of these secrets without one is a way around it.

const workflowsDir = path.resolve(import.meta.dirname, "../../.github/workflows");

const PRODUCTION_SECRETS = ["DATABASE_URL", "DIRECT_URL", "ORACLE_SSH_KEY", "ORACLE_SSH_USER"];

function secretsUsedBy(job) {
  const used = new Set();
  for (const match of JSON.stringify(job).matchAll(/secrets\.([A-Z0-9_]+)/g)) used.add(match[1]);
  return [...used].filter((name) => PRODUCTION_SECRETS.includes(name));
}

test("every job that uses a production secret declares a GitHub environment", () => {
  const unprotected = [];
  for (const file of fs.readdirSync(workflowsDir).filter((f) => /\.ya?ml$/.test(f))) {
    const doc = yaml.load(fs.readFileSync(path.join(workflowsDir, file), "utf8"));
    for (const [jobId, job] of Object.entries(doc.jobs ?? {})) {
      const used = secretsUsedBy(job);
      if (used.length > 0 && !job.environment) unprotected.push(`${file} > ${jobId} uses ${used.join(", ")}`);
    }
  }
  assert.deepEqual(unprotected, [], `jobs using production secrets without an environment:\n${unprotected.join("\n")}`);
});

test("the deploy and migrate jobs use the intended environments", () => {
  const load = (file) => yaml.load(fs.readFileSync(path.join(workflowsDir, file), "utf8"));
  const name = (env) => (typeof env === "string" ? env : env?.name);

  const deploy = load("deploy-oracle.yml");
  assert.equal(name(deploy.jobs.migrate.environment), "production-deploy");
  assert.equal(name(deploy.jobs.deploy.environment), "production-deploy");

  const webMigrate = load("web-prisma-migrate.yml");
  assert.equal(name(webMigrate.jobs["migrate-web-db"].environment), "production-migrate");
});
