import fs from 'fs';
import path from 'path';
import process from 'process';
import { fileURLToPath } from 'url';

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

const requiredPaths = [
  { path: 'apps/web/scripts/run-with-env.mjs', type: 'file' },
  { path: 'apps/web/scripts/repair-package-exports.mjs', type: 'file' },
  { path: 'apps/api/scripts', type: 'dir' },
  { path: 'apps/api/src/types/hubspot-api-client.d.ts', type: 'file' },
  { path: 'apps/web/src/types/hubspot-api-client.d.ts', type: 'file' },
  { path: 'apps/web/src/types/next-server-shim.d.ts', type: 'file' },
];

let missingCount = 0;

for (const entry of requiredPaths) {
  const fullPath = path.join(repoRoot, entry.path);
  const exists = fs.existsSync(fullPath);
  const stat = exists ? fs.statSync(fullPath) : null;
  const matchesType =
    exists &&
    ((entry.type === 'file' && stat?.isFile()) ||
      (entry.type === 'dir' && stat?.isDirectory()));

  if (matchesType) {
    console.log(`[PASS] ${entry.type}: ${entry.path}`);
  } else {
    missingCount += 1;
    const actual = !exists ? 'missing' : stat?.isDirectory() ? 'dir' : 'file';
    console.log(`[FAIL] expected ${entry.type}, got ${actual}: ${entry.path}`);
  }
}

if (missingCount > 0) {
  console.error(`Preflight failed: ${missingCount} required path(s) missing or wrong type.`);
  process.exit(1);
}

console.log(`Preflight passed: ${requiredPaths.length} required path(s) present.`);
