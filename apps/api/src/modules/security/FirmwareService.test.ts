import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// FirmwareService.EXPECTED_HASH is a static field read from process.env at
// class-definition time, so each test needs a fresh module instance after
// setting the env var, not just a fresh process.env value.
async function loadFirmwareService() {
    vi.resetModules();
    const mod = await import("./FirmwareService");
    return mod.FirmwareService;
}

describe("FirmwareService.verifyAttestation", () => {
    const originalEnv = { ...process.env };

    beforeEach(() => {
        vi.resetModules();
    });

    afterEach(() => {
        process.env = { ...originalEnv };
    });

    it("throws when no expected hash is configured", async () => {
        delete process.env["FIRMWARE_EXPECTED_HASH"];
        const FirmwareService = await loadFirmwareService();
        expect(() => FirmwareService.verifyAttestation("node-1", "a".repeat(64))).toThrow(
            "Firmware expected hash is not configured"
        );
    });

    it("accepts a matching boot hash", async () => {
        process.env["FIRMWARE_EXPECTED_HASH"] = "a".repeat(64);
        const FirmwareService = await loadFirmwareService();
        expect(FirmwareService.verifyAttestation("node-1", "a".repeat(64))).toBe(true);
    });

    it("rejects a mismatched boot hash of the same length", async () => {
        process.env["FIRMWARE_EXPECTED_HASH"] = "a".repeat(64);
        const FirmwareService = await loadFirmwareService();
        expect(FirmwareService.verifyAttestation("node-1", "b".repeat(64))).toBe(false);
    });

    it("rejects a boot hash of a different length instead of throwing", async () => {
        process.env["FIRMWARE_EXPECTED_HASH"] = "a".repeat(64);
        const FirmwareService = await loadFirmwareService();
        expect(FirmwareService.verifyAttestation("node-1", "a".repeat(10))).toBe(false);
    });
});
