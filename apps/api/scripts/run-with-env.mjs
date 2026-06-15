import { spawn } from "node:child_process";
import fs from "node:fs";
import path from "node:path";

const args = process.argv.slice(2);
const separatorIndex = args.indexOf("--");
const envArgs = separatorIndex === -1 ? [] : args.slice(0, separatorIndex);
const commandArgs = separatorIndex === -1 ? args : args.slice(separatorIndex + 1);

if (commandArgs.length === 0) {
  console.error("[run-with-env] missing command");
  process.exit(1);
}

const env = { ...process.env };

for (const entry of envArgs) {
  const equalsIndex = entry.indexOf("=");
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

function resolveExecutable(command) {
  if (process.platform !== "win32") {
    return command;
  }

  const extensions = (env.PATHEXT || ".COM;.EXE;.BAT;.CMD")
    .split(";")
    .filter(Boolean);
  const hasExecutableExtension = extensions.some((extension) =>
    command.toLowerCase().endsWith(extension.toLowerCase())
  );
  const candidates = hasExecutableExtension
    ? [command]
    : [...extensions.map((extension) => `${command}${extension.toLowerCase()}`), command];
  const commandHasPath = command.includes("\\") || command.includes("/");
  const searchDirs = commandHasPath
    ? [process.cwd()]
    : (env.PATH || "").split(path.delimiter).filter(Boolean);

  for (const dir of searchDirs) {
    for (const candidate of candidates) {
      const absolute = commandHasPath ? path.resolve(process.cwd(), candidate) : path.join(dir, candidate);
      if (fs.existsSync(absolute)) {
        return absolute;
      }
    }
  }

  return command;
}

function quoteCmdArg(value) {
  return `"${String(value).replace(/(["^])/g, "^$1")}"`;
}

function resolveSpawn(command, args) {
  const executable = resolveExecutable(command);
  if (process.platform === "win32" && /\.(?:cmd|bat)$/i.test(executable)) {
    const quotedCommand = [executable, ...args].map(quoteCmdArg).join(" ");
    return {
      command: env.ComSpec || "cmd.exe",
      args: ["/d", "/s", "/c", `"${quotedCommand}"`],
      windowsVerbatimArguments: true,
    };
  }

  return { command: executable, args, windowsVerbatimArguments: false };
}

const spawnTarget = resolveSpawn(commandArgs[0], commandArgs.slice(1));
const child = spawn(spawnTarget.command, spawnTarget.args, {
  cwd: process.cwd(),
  env,
  stdio: "inherit",
  shell: false,
  windowsVerbatimArguments: spawnTarget.windowsVerbatimArguments,
});

child.on("error", (error) => {
  console.error(`[run-with-env] failed to start ${commandArgs[0]}: ${error.message}`);
  process.exit(1);
});

child.on("exit", (code, signal) => {
  if (signal) {
    process.kill(process.pid, signal);
    return;
  }

  process.exit(code ?? 1);
});
