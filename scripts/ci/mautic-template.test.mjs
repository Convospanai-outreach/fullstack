import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";

import yaml from "js-yaml";

// Mautic is deployed by deploy/aws/mautic/mautic.yaml. These checks pin the
// security properties that are easy to lose in an edit: Cloudflare-only
// ingress, the proxy chain Mautic trusts (roadmap S-17: never 0.0.0.0/0),
// IMDSv2, encryption, and retained state.

const repoRoot = path.resolve(import.meta.dirname, "../..");
const templatePath = path.join(repoRoot, "deploy/aws/mautic/mautic.yaml");

// js-yaml rejects CloudFormation's short-form tags (!Ref, !Sub, ...) by default.
const intrinsics = ["Base64", "Cidr", "FindInMap", "GetAtt", "GetAZs", "ImportValue", "Join", "Select", "Split", "Sub", "Ref",
  "Equals", "If", "Not", "And", "Or", "Condition"];
const cfnSchema = yaml.DEFAULT_SCHEMA.extend(
  intrinsics.flatMap((name) =>
    ["scalar", "sequence", "mapping"].map(
      (kind) =>
        new yaml.Type(`!${name}`, {
          kind,
          construct: (data) => ({ [name === "Ref" ? "Ref" : `Fn::${name}`]: data }),
        }),
    ),
  ),
);

function loadTemplate(file = templatePath) {
  return yaml.load(fs.readFileSync(file, "utf8"), { schema: cfnSchema });
}

// Content of a file cfn-init writes; plain string or the string inside !Sub.
function initFile(template, file) {
  const content = template.Resources.Instance.Metadata["AWS::CloudFormation::Init"].config.files[file]?.content;
  assert.ok(content, `cfn-init writes ${file}`);
  return typeof content === "string" ? content : content["Fn::Sub"];
}

const cidrsIn = (text) => [...text.matchAll(/\b\d{1,3}(?:\.\d{1,3}){3}\/\d{1,2}\b/g)].map((m) => m[0]);

test("no compose file or template in the repo trusts every proxy (S-17)", () => {
  const candidates = [
    ...fs.readdirSync(repoRoot).filter((f) => /^docker-compose.*\.ya?ml$/.test(f)),
    path.relative(repoRoot, templatePath),
  ];
  for (const file of candidates) {
    const text = fs.readFileSync(path.join(repoRoot, file), "utf8");
    assert.doesNotMatch(text, /TRUSTED_PROXIES[^\n]*0\.0\.0\.0\/0/, `${file} trusts every proxy`);
  }
});

test("Mautic trusts only the compose network that Caddy runs on", () => {
  const template = loadTemplate();
  const compose = yaml.load(initFile(template, "/opt/mautic/compose.yaml"));
  const subnets = compose.networks.default.ipam.config.map((c) => c.subnet);
  const bootstrap = initFile(template, "/opt/mautic/bootstrap.sh");
  const trusted = bootstrap.match(/trusted_proxies: \[([^\]]*)\]/);
  assert.ok(trusted, "bootstrap.sh sets trusted_proxies");
  assert.deepEqual(cidrsIn(trusted[1]), subnets);
  assert.ok(!subnets.includes("0.0.0.0/0"));
});

test("only Cloudflare reaches the origin, on 443, and Caddy trusts exactly those ranges", () => {
  const template = loadTemplate();
  const ingress = template.Resources.SecurityGroup.Properties.SecurityGroupIngress;
  assert.ok(ingress.length > 0);
  for (const rule of ingress) {
    assert.deepEqual([rule.IpProtocol, rule.FromPort, rule.ToPort], ["tcp", 443, 443], JSON.stringify(rule));
    assert.notEqual(rule.CidrIp, "0.0.0.0/0");
    assert.equal(rule.CidrIpv6, undefined);
  }
  const caddyTrusted = initFile(template, "/opt/mautic/Caddyfile").match(/trusted_proxies static ([^\n]+)/);
  assert.ok(caddyTrusted, "Caddyfile sets trusted_proxies");
  assert.deepEqual(cidrsIn(caddyTrusted[1]).sort(), ingress.map((r) => r.CidrIp).sort());
  assert.match(initFile(template, "/opt/mautic/Caddyfile"), /header_up X-Forwarded-For \{client_ip\}/);
});

test("the instance requires IMDSv2, has no SSH key, and every volume is encrypted", () => {
  const { Resources } = loadTemplate();
  const instance = Resources.Instance.Properties;
  assert.equal(instance.MetadataOptions.HttpTokens, "required");
  assert.equal(instance.MetadataOptions.HttpPutResponseHopLimit, 1);
  assert.equal(instance.KeyName, undefined);
  for (const mapping of instance.BlockDeviceMappings) assert.equal(mapping.Ebs.Encrypted, true);
  assert.equal(Resources.DataVolume.Properties.Encrypted, true);
});

test("state survives stack deletion and replacement, and no secret is a parameter", () => {
  const { Resources, Parameters } = loadTemplate();
  for (const id of ["DataVolume", "AdminSecret", "ExternalSecret"]) {
    assert.equal(Resources[id].DeletionPolicy, "Retain", `${id} DeletionPolicy`);
    assert.equal(Resources[id].UpdateReplacePolicy, "Retain", `${id} UpdateReplacePolicy`);
  }
  for (const name of Object.keys(Parameters)) {
    assert.doesNotMatch(name, /password|secret|token|apikey|api_key|privatekey/i, `parameter ${name}`);
  }
});

test("the embedded shell scripts parse", { skip: process.platform === "win32" && "bash -n runs in CI (Linux)" }, () => {
  const template = loadTemplate();
  for (const file of ["/opt/mautic/host-setup.sh", "/opt/mautic/bootstrap.sh"]) {
    const result = spawnSync("bash", ["-n"], { input: initFile(template, file), encoding: "utf8" });
    assert.equal(result.status, 0, `${file}: ${result.stderr}`);
  }
  const power = spawnSync("bash", ["-n", path.join(repoRoot, "deploy/aws/mautic/mautic-power.sh")], { encoding: "utf8" });
  assert.equal(power.status, 0, `mautic-power.sh: ${power.stderr}`);
});

// CloudFormation rejects AWS::Budgets::Budget in eu-north-1 ("Unrecognized
// resource types"), so the cost alert is its own us-east-1 stack.
test("the Mautic stack has no Budgets resource; budget.yaml alerts on gross cost", () => {
  const regional = Object.values(loadTemplate().Resources).map((r) => r.Type);
  assert.ok(!regional.includes("AWS::Budgets::Budget"), "mautic.yaml deploys to eu-north-1, where Budgets is unavailable");
  const budget = loadTemplate(path.join(repoRoot, "deploy/aws/mautic/budget.yaml"));
  const budgets = Object.values(budget.Resources).filter((r) => r.Type === "AWS::Budgets::Budget");
  assert.equal(budgets.length, 1);
  assert.equal(budgets[0].Properties.Budget.CostTypes.IncludeCredit, false);
  // The stack costs about $20 a month; a lower limit makes the 80% alert fire every month.
  assert.ok(budget.Parameters.MonthlyBudgetUsd.Default >= 25, "default budget sits above expected spend");
});

// Development cost saver: the stack stops (never terminates) an idle instance,
// behind one switch that turns it off when Mautic goes live.
test("idle auto-stop is switchable, stops on low outbound traffic, and matches mautic-power.sh", () => {
  const { Parameters, Conditions, Resources } = loadTemplate();
  assert.deepEqual(Parameters.AutoStopWhenIdle.AllowedValues, ["true", "false"]);
  assert.deepEqual(Conditions.AutoStop, { "Fn::Equals": [{ Ref: "AutoStopWhenIdle" }, "true"] });
  const alarm = Resources.IdleStopAlarm;
  assert.equal(alarm.Condition, "AutoStop");
  assert.equal(alarm.Properties.MetricName, "NetworkOut");
  assert.equal(alarm.Properties.ComparisonOperator, "LessThanThreshold");
  assert.equal(alarm.Properties.TreatMissingData, "notBreaching");
  assert.deepEqual(alarm.Properties.AlarmActions, [{ "Fn::Sub": "arn:${AWS::Partition}:automate:${AWS::Region}:ec2:stop" }]);
  const script = fs.readFileSync(path.join(repoRoot, "deploy/aws/mautic/mautic-power.sh"), "utf8");
  for (const id of ["Instance", "IdleStopAlarm"]) {
    assert.ok(Resources[id], `${id} exists`);
    assert.match(script, new RegExp(`resource ${id}[ )]`), `mautic-power.sh looks up ${id}`);
  }
});
