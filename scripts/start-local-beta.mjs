import path from "node:path";
import { createConnection } from "node:net";
import { spawn } from "node:child_process";
import pg from "pg";

const rootDir = process.cwd();
const prismaCli = path.join(rootDir, "node_modules", "prisma", "build", "index.js");
const databaseUrl = process.env.DATABASE_URL || "postgresql://postgres:postgres@localhost:5433/craftmyfunnel?schema=public";
const isWindows = process.platform === "win32";
const withEdge = process.argv.includes("--with-edge") || process.env.START_EDGE === "true";

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
        return json?.service === "craftmyfunnel-api";
    } catch {
        return false;
    }
}

async function hasApiSchema() {
    const pool = new pg.Pool({
        connectionString: databaseUrl,
    });

    try {
        const result = await pool.query(`
            SELECT EXISTS (
                SELECT 1
                FROM information_schema.tables
                WHERE table_schema = 'public'
                  AND table_name IN ('User', 'Lead', 'Campaign')
            ) AS schema_ready
        `);

        return Boolean(result.rows[0]?.schema_ready);
    } catch {
        return false;
    } finally {
        await pool.end().catch(() => {});
    }
}

async function isWebReachable() {
    try {
        const response = await fetch("http://127.0.0.1:3000/", {
            redirect: "manual",
            signal: AbortSignal.timeout(3500),
        });
        if (response.status < 200 || response.status >= 400) {
            return false;
        }

        const html = await response.text().catch(() => "");
        const cssPaths = Array.from(
            new Set(
                [...html.matchAll(/href="(\/_next\/static\/css\/[^"]+\.css)"/g)].map((match) => match[1])
            )
        );

        for (const cssPath of cssPaths.slice(0, 5)) {
            const cssResponse = await fetch(`http://127.0.0.1:3000${cssPath}`, {
                redirect: "manual",
                signal: AbortSignal.timeout(3500),
            });
            if (!cssResponse.ok) {
                return false;
            }
        }

        return true;
    } catch {
        return false;
    }
}

async function isEdgeHealthy() {
    try {
        const response = await fetch("http://127.0.0.1:8000/health", {
            signal: AbortSignal.timeout(3500),
        });
        if (!response.ok) {
            return false;
        }
        const json = await response.json().catch(() => null);
        return json?.status === "ONLINE";
    } catch {
        return false;
    }
}

async function waitForEdgeHealth(maxAttempts = 60, delayMs = 1500) {
    for (let attempt = 0; attempt < maxAttempts; attempt++) {
        if (await isEdgeHealthy()) {
            return true;
        }
        await new Promise((resolve) => setTimeout(resolve, delayMs));
    }
    return false;
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

    if (await hasApiSchema()) {
        console.log("\n[beta:start] API schema already present. Skipping Prisma sync.");
    } else {
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
    }

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
            throw new Error("Port 3000 is in use by an unhealthy web process (likely stale CSS chunks). Stop that process and rerun beta:start.");
        }
    } else {
        const web = spawnCommand("npm", ["run", "dev:web"]);
        childProcesses.push(web);
        startedServices.push({ name: "Web", process: web });
    }

    if (startedServices.length === 0) {
        console.log("[beta:start] API and Web are already running. Nothing to launch.");
    } else {
        for (const service of startedServices) {
            service.process.on("exit", (code) => {
                if (!shuttingDown) {
                    console.error(`[beta:start] ${service.name} exited (${code ?? "unknown"}). Stopping stack.`);
                    shutdown(code ?? 1);
                }
            });
        }
    }

    if (!withEdge) {
        return;
    }

    console.log("\n[beta:start] Ensuring Edge FastAPI is running");
    const edgePortBusy = await isPortListening(8000);
    if (edgePortBusy) {
        if (await isEdgeHealthy()) {
            console.log("[beta:start] Edge FastAPI is already running on port 8000. Reusing it.");
            return;
        }
        throw new Error("Port 8000 is in use by another process. Stop that process and rerun beta:start:all.");
    }

    await runStep(
        "Starting edge-fastapi container",
        "docker",
        ["compose", "-f", "apps/docker-compose.split.yml", "up", "-d", "--no-deps", "edge-fastapi"],
        {
            env: {
                ...process.env,
                EDGE_DATABASE_URL:
                    process.env.EDGE_DATABASE_URL ||
                    "postgresql://postgres:postgres@host.docker.internal:5433/craftmyfunnel",
            },
        }
    );

    const edgeHealthy = await waitForEdgeHealth();
    if (!edgeHealthy) {
        throw new Error("edge-fastapi did not become healthy on port 8000.");
    }
    console.log("[beta:start] Edge FastAPI is healthy on port 8000.");
}

main().catch((error) => {
    console.error(`[beta:start] ${error.message}`);
    process.exit(1);
});
