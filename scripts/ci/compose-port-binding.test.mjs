import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";

import yaml from "js-yaml";

// Prometheus, Grafana, the browserless Chrome node and the edge-sim database/API are
// unauthenticated or ship default credentials. A bare "3001:3000" publishes them on every
// interface of the host, so anyone who can reach the machine can use them. They must be
// published on loopback only (reach them over an SSH tunnel on a remote host).

const rootDir = path.resolve(import.meta.dirname, "../..");

const LOCAL_ONLY_SERVICES = {
  "docker-compose.monitoring.yml": ["prometheus", "grafana"],
  "docker-compose.staging.yml": ["prometheus", "grafana"],
  "docker-compose.edge.yml": ["edge-node-sim", "postgres-edge", "browser-node"],
};

function publishedBindAddress(port) {
  // "127.0.0.1:3001:3000" -> "127.0.0.1"; "3001:3000" and "3000" -> undefined (all interfaces)
  const parts = String(port).split(":");
  return parts.length >= 3 ? parts[0] : undefined;
}

for (const [file, services] of Object.entries(LOCAL_ONLY_SERVICES)) {
  test(`${file}: ${services.join(", ")} publish ports on loopback only`, () => {
    const doc = yaml.load(fs.readFileSync(path.join(rootDir, file), "utf8"));
    for (const name of services) {
      const service = doc.services?.[name];
      assert.ok(service, `${file} defines ${name}`);
      assert.ok(Array.isArray(service.ports) && service.ports.length > 0, `${file} ${name} publishes no ports`);
      for (const port of service.ports) {
        assert.equal(publishedBindAddress(port), "127.0.0.1", `${file} ${name} publishes "${port}" on all interfaces`);
      }
    }
  });
}
