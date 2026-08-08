import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import axios from "axios";

const EDGE_NODE_URL = process.env["EDGE_NODE_URL"] || process.env["EDGE_NODE_URI"] || "http://localhost:8081";
const NETJANA_URL = process.env["NETJANA_URL"] || "";

interface ServiceStatus {
    name: string;
    status: "online" | "degraded" | "offline" | "disabled";
    required?: boolean;
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
            required: true,
            latencyMs: Date.now() - start,
            detail: "PostgreSQL connected",
        };
    } catch (e: any) {
        return {
            name: "CraftMyFunnel DB",
            status: "offline",
            required: true,
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
            required: false,
            latencyMs: latency,
            detail: hardware_id ? `HW: ${hardware_id}` : "No hardware ID",
        };
    } catch (e: any) {
        return {
            name: "Raspberry Pi Node",
            status: "disabled",
            required: false,
            latencyMs: Date.now() - start,
            detail: "Optional edge runtime (not deployed)",
        };
    }
}

async function checkNetjana(): Promise<ServiceStatus> {
    if (!NETJANA_URL) {
        return {
            name: "Netjana Signals",
            status: "disabled",
            required: false,
            detail: "Optional signal scraper (not configured)",
        };
    }
    const start = Date.now();
    try {
        const res = await axios.get(`${NETJANA_URL}/health`, { timeout: 3000 });
        const latency = Date.now() - start;
        return {
            name: "Netjana Signals",
            status: res.status === 200 ? "online" : "degraded",
            required: false,
            latencyMs: latency,
            detail: "Signal scraper responding",
        };
    } catch (e: any) {
        return {
            name: "Netjana Signals",
            status: "disabled",
            required: false,
            latencyMs: Date.now() - start,
            detail: "Optional signal scraper (unreachable)",
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
        db.status === "fulfilled" ? db.value : { name: "CraftMyFunnel DB", status: "offline", required: true, detail: "Check failed" },
        edgeNode.status === "fulfilled" ? edgeNode.value : { name: "Raspberry Pi Node", status: "disabled", required: false, detail: "Check failed" },
        netjana.status === "fulfilled" ? netjana.value : { name: "Netjana Signals", status: "disabled", required: false, detail: "Check failed" },
    ];

    const requiredServices = results.filter(r => r.required !== false);
    const overall = requiredServices.every(r => r.status === "online")
        ? "online"
        : requiredServices.some(r => r.status === "online")
        ? "degraded"
        : "offline";

    return NextResponse.json({ overall, services: results, checkedAt: new Date().toISOString() });
}
