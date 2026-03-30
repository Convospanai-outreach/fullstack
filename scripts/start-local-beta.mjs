import path from "node:path";
import { createConnection } from "node:net";
import { spawn } from "node:child_process";

const rootDir = process.cwd();
const prismaCli = path.join(rootDir, "node_modules", "prisma", "build", "index.js");
const databaseUrl = process.env.DATABASE_URL || "postgresql://postgres:postgres@localhost:5433/convospan?schema=public";
const isWindows = process.platform === "win32";

const childProcesses = [];
let shuttingDown = false;

function spawnCommand(command, args, options = {}) {
    const executable = isWindows && command === "npm" ? "npm.cmd" : command;
    return spawn(executable, args, {
        cwd: rootDir,
        stdio: "inherit",
        shell: false,
        ...options,
        windowsHide: true,
    });
}

function runStep(name, command, args, options = {}) {
    return new Promise((resolve, reject) => {
        console.log(`\n[beta:start] ${name}`);
        const child = spawnCommand(command, args, options);
        child.on("exit", (code) => {
            if (code === 0) {
                resolve();
                return;
            }
            reject(new Error(`${name} failed with exit code ${code ?? "unknown"}`));
        });
        child.on("error", reject);
    });
}

function killProcessTree(pid) {
    if (!pid) {
        return;
    }
    if (isWindows) {
        spawn("taskkill", ["/pid", String(pid), "/t", "/f"], { stdio: "ignore" });
        return;
    }
    process.kill(pid, "SIGTERM");
}

function isPortListening(port) {
    return new Promise((resolve) => {
        const socket = createConnection({ host: "127.0.0.1", port });
        const done = (result) => {
            socket.removeAllListeners();
            socket.destroy();
            resolve(result);
        };

        socket.setTimeout(1200);
        socket.once("connect", () => done(true));
        socket.once("timeout", () => done(false));
        socket.once("error", () => done(false));
    });
}

async function isApiHealthy() {
    try {
        const response = await fetch("http://127.0.0.1:3001/health", {
            signal: AbortSignal.timeout(3500),
        });
        if (!response.ok) {
            return false;
        }
        const json = await response.json().catch(() => null);
        return json?.service === "convospan-api";
    } catch {
        return false;
    }
}

async function isWebReachable() {
    try {
        const response = await fetch("http://127.0.0.1:3000/", {
            redirect: "manual",
            signal: AbortSignal.timeout(3500),
        });
        return response.status >= 200 && response.status < 500;
    } catch {
        return false;
    }
}

function shutdown(code = 0) {
    if (shuttingDown) {
        return;
    }
    shuttingDown = true;
    for (const child of childProcesses) {
        killProcessTree(child.pid);
    }
    setTimeout(() => process.exit(code), 600);
}

process.on("SIGINT", () => shutdown(0));
process.on("SIGTERM", () => shutdown(0));

async function main() {
    await runStep("Starting Docker services (db, redis)", "docker", ["compose", "up", "-d", "db", "redis"]);

    await runStep(
        "Pushing Prisma schema for API",
        "node",
        [
            prismaCli,
            "db",
            "push",
            "--schema",
            "apps/api/prisma/schema.prisma",
            "--url",
            databaseUrl,
            "--accept-data-loss",
        ],
        {
            env: {
                ...process.env,
                PRISMA_CLIENT_ENGINE_TYPE: process.env.PRISMA_CLIENT_ENGINE_TYPE || "binary",
            },
        }
    );

    console.log("\n[beta:start] Launching API and Web");

    const startedServices = [];

    const apiPortBusy = await isPortListening(3001);
    if (apiPortBusy) {
        if (await isApiHealthy()) {
            console.log("[beta:start] API is already running on port 3001. Reusing it.");
        } else {
            throw new Error("Port 3001 is in use by another process. Stop that process and rerun beta:start.");
        }
    } else {
        const api = spawnCommand("npm", ["run", "start:api"]);
        childProcesses.push(api);
        startedServices.push({ name: "API", process: api });
    }

    const webPortBusy = await isPortListening(3000);
    if (webPortBusy) {
        if (await isWebReachable()) {
            console.log("[beta:start] Web is already running on port 3000. Reusing it.");
        } else {
            throw new Error("Port 3000 is in use by another process. Stop that process and rerun beta:start.");
        }
    } else {
        const web = spawnCommand("npm", ["run", "start:web"]);
        childProcesses.push(web);
        startedServices.push({ name: "Web", process: web });
    }

    if (startedServices.length === 0) {
        console.log("[beta:start] API and Web are already running. Nothing to launch.");
        return;
    }

    for (const service of startedServices) {
        service.process.on("exit", (code) => {
            if (!shuttingDown) {
                console.error(`[beta:start] ${service.name} exited (${code ?? "unknown"}). Stopping stack.`);
                shutdown(code ?? 1);
            }
        });
    }
}

main().catch((error) => {
    console.error(`[beta:start] ${error.message}`);
    process.exit(1);
});
