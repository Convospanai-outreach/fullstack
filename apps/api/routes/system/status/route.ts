import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import axios from "axios";

const EDGE_NODE_URL = process.env["EDGE_NODE_URL"] || process.env["EDGE_NODE_URI"] || "http://localhost:8081";
const NETJANA_URL = process.env["NETJANA_URL"] || "";

interface ServiceStatus {
    name: string;
    status: "online" | "degraded" | "offline";
    latencyMs?: number;
    detail?: string;
}

async function checkDatabase(): Promise<ServiceStatus> {
    const start = Date.now();
    try {
        await prisma.$queryRaw`SELECT 1`;
        return {
            name: "CraftMyFunnel DB",
            status: "online",
            latencyMs: Date.now() - start,
            detail: "PostgreSQL connected",
        };
    } catch (e: any) {
        return {
            name: "CraftMyFunnel DB",
            status: "offline",
            latencyMs: Date.now() - start,
            detail: e.message?.slice(0, 80) ?? "DB unreachable",
        };
    }
}

async function checkEdgeNode(): Promise<ServiceStatus> {
    const start = Date.now();
    try {
        const res = await axios.get(`${EDGE_NODE_URL}/health`, { timeout: 3000 });
        const latency = Date.now() - start;
        const { status, hardware_id } = res.data ?? {};
        return {
            name: "Raspberry Pi Node",
            status: status === "ONLINE" ? "online" : "degraded",
            latencyMs: latency,
            detail: hardware_id ? `HW: ${hardware_id}` : "No hardware ID",
        };
    } catch (e: any) {
        return {
            name: "Raspberry Pi Node",
            status: "offline",
            latencyMs: Date.now() - start,
            detail: "Edge node unreachable",
        };
    }
}

async function checkNetjana(): Promise<ServiceStatus> {
    if (!NETJANA_URL) {
        return {
            name: "Netjana Signals",
            status: "offline",
            detail: "NETJANA_URL not configured",
        };
    }
    const start = Date.now();
    try {
        const res = await axios.get(`${NETJANA_URL}/health`, { timeout: 3000 });
        const latency = Date.now() - start;
        return {
            name: "Netjana Signals",
            status: res.status === 200 ? "online" : "degraded",
            latencyMs: latency,
            detail: "Signal scraper responding",
        };
    } catch (e: any) {
        return {
            name: "Netjana Signals",
            status: "offline",
            latencyMs: Date.now() - start,
            detail: "Netjana unreachable or not configured",
        };
    }
}

export async function GET() {
    const [db, edgeNode, netjana] = await Promise.allSettled([
        checkDatabase(),
        checkEdgeNode(),
        checkNetjana(),
    ]);

    const results: ServiceStatus[] = [
        db.status === "fulfilled" ? db.value : { name: "CraftMyFunnel DB", status: "offline", detail: "Check failed" },
        edgeNode.status === "fulfilled" ? edgeNode.value : { name: "Raspberry Pi Node", status: "offline", detail: "Check failed" },
        netjana.status === "fulfilled" ? netjana.value : { name: "Netjana Signals", status: "offline", detail: "Check failed" },
    ];

    const overall = results.every(r => r.status === "online")
        ? "online"
        : results.some(r => r.status === "online")
        ? "degraded"
        : "offline";

    return NextResponse.json({ overall, services: results, checkedAt: new Date().toISOString() });
}
