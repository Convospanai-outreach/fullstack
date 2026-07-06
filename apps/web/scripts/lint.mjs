import { spawnSync } from 'node:child_process';
import { createRequire } from 'node:module';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const webRoot = path.resolve(__dirname, '..');
const requireFromWeb = createRequire(path.join(webRoot, 'package.json'));

const eslintPackageJsonPath = requireFromWeb.resolve('eslint/package.json');
const eslintBin = path.join(path.dirname(eslintPackageJsonPath), 'bin', 'eslint.js');
const targets = process.argv.slice(2);
const lintTargets = targets.length > 0 ? targets : ['src', 'tests', 'e2e'];

const result = spawnSync(process.execPath, [eslintBin, '--format', 'json', ...lintTargets], {
  cwd: webRoot,
  encoding: 'utf8',
  env: { ...process.env },
});

const stdout = result.stdout ?? '';
const stderr = result.stderr ?? '';
const exitCode = typeof result.status === 'number' ? result.status : 1;

let parsedOutput = null;
if (stdout.trim().length > 0) {
  try {
    parsedOutput = JSON.parse(stdout);
  } catch {
    parsedOutput = null;
  }
}

const filesScanned = Array.isArray(parsedOutput) ? parsedOutput.length : 0;
const errorCount = Array.isArray(parsedOutput)
  ? parsedOutput.reduce((total, fileResult) => total + (fileResult?.errorCount ?? 0), 0)
  : 0;
const warningCount = Array.isArray(parsedOutput)
  ? parsedOutput.reduce((total, fileResult) => total + (fileResult?.warningCount ?? 0), 0)
  : 0;

if (exitCode === 0) {
  process.stdout.write(
    `${JSON.stringify({
      status: 'PASS',
      exitCode,
      targets: lintTargets,
      filesScanned,
      errorCount,
      warningCount,
    })}\n`,
  );
  process.exit(0);
}

process.stdout.write(
  `${JSON.stringify({
    status: 'FAIL',
    exitCode,
    targets: lintTargets,
    filesScanned,
    errorCount,
    warningCount,
  })}\n`,
);

if (stdout.trim().length > 0) {
  process.stderr.write(`${stdout.trim()}\n`);
}

if (stderr.trim().length > 0) {
  process.stderr.write(`${stderr.trim()}\n`);
}

process.exit(exitCode);
