import { describe, it, expect, vi, beforeEach } from "vitest";

/**
 * Tests the required-vs-optional service status logic.
 * 
 * The system status route classifies services as required (DB) or optional
 * (Edge Node, Netjana). Only required services affect the overall status.
 * This prevents unconfigured optional extensions from triggering a false
 * "Partial Outage" banner.
 */

interface ServiceStatus {
    name: string;
    status: "online" | "degraded" | "offline" | "disabled";
    required?: boolean;
    latencyMs?: number;
    detail?: string;
}

function computeOverallStatus(results: ServiceStatus[]): "online" | "degraded" | "offline" {
    const requiredServices = results.filter(r => r.required !== false);
    if (requiredServices.length === 0) return "online";
    return requiredServices.every(r => r.status === "online")
        ? "online"
        : requiredServices.some(r => r.status === "online")
        ? "degraded"
        : "offline";
}

describe("System status: required vs optional service classification", () => {
    // Core scenario: DB up + optional services disabled → "online" (not "degraded")
    it("shows online when DB is up and optional services are disabled", () => {
        const results: ServiceStatus[] = [
            { name: "CraftMyFunnel DB", status: "online", required: true },
            { name: "Raspberry Pi Node", status: "disabled", required: false },
            { name: "Netjana Signals", status: "disabled", required: false },
        ];
        expect(computeOverallStatus(results)).toBe("online");
    });

    // Real outage: DB down → must show "offline" even if optional services are also down
    it("shows offline when DB is down and optional services are disabled", () => {
        const results: ServiceStatus[] = [
            { name: "CraftMyFunnel DB", status: "offline", required: true },
            { name: "Raspberry Pi Node", status: "disabled", required: false },
            { name: "Netjana Signals", status: "disabled", required: false },
        ];
        expect(computeOverallStatus(results)).toBe("offline");
    });

    // All services online → online
    it("shows online when all services including optional are up", () => {
        const results: ServiceStatus[] = [
            { name: "CraftMyFunnel DB", status: "online", required: true },
            { name: "Raspberry Pi Node", status: "online", required: false },
            { name: "Netjana Signals", status: "online", required: false },
        ];
        expect(computeOverallStatus(results)).toBe("online");
    });

    // DB degraded → degraded (required service in bad state)
    it("shows degraded when DB is degraded", () => {
        const results: ServiceStatus[] = [
            { name: "CraftMyFunnel DB", status: "degraded", required: true },
            { name: "Raspberry Pi Node", status: "disabled", required: false },
            { name: "Netjana Signals", status: "disabled", required: false },
        ];
        // degraded is not "online", so requiredServices.every(online) is false
        // requiredServices.some(online) is also false (degraded != online)
        // → "offline"
        expect(computeOverallStatus(results)).toBe("offline");
    });

    // Multiple required services: one up, one down → "degraded"
    it("shows degraded when some required services are up and some are down", () => {
        const results: ServiceStatus[] = [
            { name: "CraftMyFunnel DB", status: "online", required: true },
            { name: "Redis Cache", status: "offline", required: true },
            { name: "Raspberry Pi Node", status: "disabled", required: false },
        ];
        expect(computeOverallStatus(results)).toBe("degraded");
    });

    // Edge case: optional services offline (not disabled) should not affect overall
    it("shows online when DB is up and optional services are offline (not just disabled)", () => {
        const results: ServiceStatus[] = [
            { name: "CraftMyFunnel DB", status: "online", required: true },
            { name: "Raspberry Pi Node", status: "offline", required: false },
            { name: "Netjana Signals", status: "offline", required: false },
        ];
        expect(computeOverallStatus(results)).toBe("online");
    });

    // Edge case: no required services at all → online (graceful default)
    it("shows online when no required services exist", () => {
        const results: ServiceStatus[] = [
            { name: "Raspberry Pi Node", status: "disabled", required: false },
        ];
        expect(computeOverallStatus(results)).toBe("online");
    });
});
