import { spawn } from "node:child_process";
import path from "node:path";
import { rm } from "node:fs/promises";

const nextCliPath = path.resolve(process.cwd(), "..", "..", "node_modules", "next", "dist", "bin", "next");
const nextArgs = [nextCliPath, "build", "--webpack"];
const nextArtifactsDir = path.join(process.cwd(), ".next");

async function runNextBuild(attempt) {
  return await new Promise((resolve) => {
    const child = spawn(process.execPath, nextArgs, {
      cwd: process.cwd(),
      env: process.env,
      stdio: "inherit",
    });

    child.on("close", (code, signal) => {
      resolve({ code: code ?? 1, signal, attempt });
    });
  });
}

async function cleanNextArtifacts() {
  await rm(nextArtifactsDir, { recursive: true, force: true, maxRetries: 3, retryDelay: 150 });
}

const firstAttempt = await runNextBuild(1);
if (firstAttempt.code === 0) {
  process.exit(0);
}

console.warn(
  `[build-next-with-retry] Build attempt ${firstAttempt.attempt} failed` +
    `${firstAttempt.signal ? ` (signal: ${firstAttempt.signal})` : ""}. ` +
    "Cleaning .next and retrying once."
);
await cleanNextArtifacts();

const retryAttempt = await runNextBuild(2);
if (retryAttempt.code !== 0) {
  console.error(
    `[build-next-with-retry] Retry failed` +
      `${retryAttempt.signal ? ` (signal: ${retryAttempt.signal})` : ""}.`
  );
}

process.exit(retryAttempt.code);
