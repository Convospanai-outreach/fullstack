import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";

const runnerPath = path.resolve("apps/api/scripts/run-with-env.mjs");

test("resolves an ancestor local .cmd shim and forwards arguments, environment, and exit status", { skip: process.platform !== "win32" }, () => {
  const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), "run-with-env-"));
  try {
    const workspaceRoot = path.join(tempRoot, "workspace");
    const apiDir = path.join(workspaceRoot, "apps", "api");
    const binDir = path.join(workspaceRoot, "node_modules", ".bin");
    fs.mkdirSync(apiDir, { recursive: true });
    fs.mkdirSync(binDir, { recursive: true });

    const capturePath = path.join(binDir, "capture.mjs");
    fs.writeFileSync(capturePath, "console.log(JSON.stringify({ args: process.argv.slice(2), assigned: process.env.TEST_ASSIGNMENT }));\n");
    const shimPath = path.join(binDir, "fixture.cmd");
    fs.writeFileSync(
      shimPath,
      `@echo off\r\n"${process.execPath}" "%~dp0capture.mjs" %*\r\nexit /b 7\r\n`,
    );

    const result = spawnSync(
      process.execPath,
      [
        runnerPath,
        "TEST_ASSIGNMENT=from-runner",
        "--",
        "fixture",
        "plain",
        "argument with spaces",
        "quoted\\\"value",
        "key=value",
        "C:\\Path With Spaces\\file.txt",
      ],
      { cwd: apiDir, encoding: "utf8" },
    );

    assert.equal(result.status, 7, result.stderr);
    assert.deepEqual(JSON.parse(result.stdout), {
      args: ["plain", "argument with spaces", "quoted\\\"value", "key=value", "C:\\Path With Spaces\\file.txt"],
      assigned: "from-runner",
    });
  } finally {
    fs.rmSync(tempRoot, { recursive: true, force: true });
  }
});
