import { spawn } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';

const args = process.argv.slice(2);
const separatorIndex = args.indexOf('--');
const envArgs = separatorIndex === -1 ? [] : args.slice(0, separatorIndex);
const commandArgs = separatorIndex === -1 ? args : args.slice(separatorIndex + 1);

if (commandArgs.length === 0) {
  console.error('[run-with-env] missing command');
  process.exit(1);
}

const env = { ...process.env };

for (const entry of envArgs) {
  const equalsIndex = entry.indexOf('=');
  if (equalsIndex <= 0) {
    console.error(`[run-with-env] invalid env assignment: ${entry}`);
    process.exit(1);
  }

  const key = entry.slice(0, equalsIndex);
  const value = entry.slice(equalsIndex + 1);
  env[key] = value;
}

const tempValue = env.TEMP || env.TMP || env.TMPDIR;
if (tempValue) {
  const tempPath = path.resolve(process.cwd(), tempValue);
  fs.mkdirSync(tempPath, { recursive: true });
  env.TEMP = tempPath;
  env.TMP = tempPath;
  env.TMPDIR = tempPath;
  env.npm_config_tmp = tempPath;
}

const child = spawn(commandArgs[0], commandArgs.slice(1), {
  cwd: process.cwd(),
  env,
  stdio: 'inherit',
  shell: process.platform === 'win32',
});

child.on('exit', (code, signal) => {
  if (signal) {
    process.kill(process.pid, signal);
    return;
  }

  process.exit(code ?? 1);
});
