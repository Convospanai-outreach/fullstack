import fetch from "node-fetch";

async function check(url: string) {
    const res = await fetch(url, { method: "GET" });
    if (!res.ok) {
        throw new Error(`health check failed: ${url} ${res.status}`);
    }
}

async function main() {
    const base = process.env["NEXT_PUBLIC_API_URL"] || "http://localhost:3001";
    const managed = process.env["MANAGED_RUNTIME_URL"] || "http://localhost:8080";
    const edge = process.env["EDGE_NODE_URI"] || "http://localhost:8000";

    await check(`${base}/v1/system/health`);
    await check(`${managed}/health`);
    await check(`${managed}/capabilities`);
    await check(`${edge}/health`);
    await check(`${edge}/capabilities`);

    console.log("post-deploy smoke OK");
}

main().catch(err => {
    console.error(err);
    process.exit(1);
});
