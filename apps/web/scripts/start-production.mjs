import path from "node:path";
import { spawn } from "node:child_process";
import { existsSync } from "node:fs";

const rootDir = process.cwd();
const standaloneEntry = path.join(rootDir, ".next", "standalone", "server.js");
const useStandalone = process.env["NEXT_USE_STANDALONE"] === "true" && existsSync(standaloneEntry);

const command = useStandalone
    ? ["node", [standaloneEntry]]
    : ["node", [path.join(rootDir, "..", "..", "node_modules", "next", "dist", "bin", "next"), "start"]];

const child = spawn(command[0], command[1], {
    cwd: useStandalone ? path.dirname(standaloneEntry) : rootDir,
    env: process.env,
    stdio: "inherit",
    shell: process.platform === "win32",
});

child.on("exit", (code, signal) => {
    if (signal) {
        process.kill(process.pid, signal);
        return;
    }

    process.exit(code ?? 1);
});
