import { describe, expect, it, vi } from "vitest";
import { planEmailVerification, runEmailVerification } from "./emailStatusBatch";
import type { VerifyDeps } from "./emailStatus";

const leads = [
    { id: "a", email: "ann@acme.com", emailStatus: "UNKNOWN" },
    { id: "b", email: "bad-address", emailStatus: "UNKNOWN" },
    { id: "c", email: "info@acme.com", emailStatus: "UNKNOWN" },
    { id: "d", email: "dan@acme.com", emailStatus: "VERIFIED" },
    { id: "e", email: null, emailStatus: "UNKNOWN" },
    { id: "f", email: "fay@acme.com", emailStatus: "GUESS" },
];

const deps = (): VerifyDeps => ({
    lookupMx: vi.fn().mockResolvedValue(["mx.acme.com"]),
    providerVerify: vi.fn().mockResolvedValue({ status: "valid" }),
});

describe("planEmailVerification", () => {
    it("counts the provider checks a batch will use, without calling the provider", async () => {
        const d = deps();
        const plan = await planEmailVerification(leads, d);
        expect(plan).toEqual({ total: 6, skipped: 2, answeredFree: 2, providerChecks: 2 });
        expect(d.providerVerify).not.toHaveBeenCalled();
    });
});

describe("runEmailVerification", () => {
    it("saves each lead's status and source, and only uses the provider for the rest", async () => {
        const d = deps();
        const save = vi.fn().mockResolvedValue(undefined);
        const out = await runEmailVerification(leads, d, save);

        expect(d.providerVerify).toHaveBeenCalledTimes(2);
        expect(out).toEqual({ checked: 4, providerChecks: 2 });
        expect(save).toHaveBeenCalledWith("b", expect.objectContaining({ status: "INVALID", source: "SYNTAX" }));
        expect(save).toHaveBeenCalledWith("c", expect.objectContaining({ status: "RISKY", source: "ROLE" }));
        expect(save).toHaveBeenCalledWith("a", expect.objectContaining({ status: "VERIFIED", source: "HUNTER" }));
        expect(save).toHaveBeenCalledWith("f", expect.objectContaining({ status: "VERIFIED", source: "HUNTER" }));
        expect(save).not.toHaveBeenCalledWith("d", expect.anything());
    });

    it("keeps a lead's earlier status when the provider could not answer", async () => {
        const d = { ...deps(), providerVerify: vi.fn().mockRejectedValue(new Error("timeout")) };
        const save = vi.fn().mockResolvedValue(undefined);
        await runEmailVerification([leads[0]!], d, save);
        expect(save).not.toHaveBeenCalled();
    });
});
