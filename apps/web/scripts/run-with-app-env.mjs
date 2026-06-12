import { spawn } from "node:child_process";
import dotenv from "dotenv";

// Load defaults from .env without clobbering explicitly provided runtime env vars.
dotenv.config({ path: ".env" });

const commandArgs = process.argv.slice(2);
if (commandArgs.length === 0) {
  console.error("[run-with-app-env] missing command");
  process.exit(1);
}

const env = {
  ...process.env,
  PRISMA_CLIENT_ENGINE_TYPE: process.env.PRISMA_CLIENT_ENGINE_TYPE || "client",
};

const child = spawn(process.execPath, commandArgs, {
  cwd: process.cwd(),
  env,
  stdio: "inherit",
  shell: false,
});

child.on("exit", (code, signal) => {
  if (signal) {
    process.kill(process.pid, signal);
    return;
  }

  process.exit(code ?? 1);
});
