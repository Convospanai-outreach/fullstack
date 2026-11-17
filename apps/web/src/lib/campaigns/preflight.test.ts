import { describe, expect, it } from "vitest";
import { MAX_PREFLIGHT_ANSWER_CHARS, preflightStatus, sanitizePreflight } from "./preflight";

const FULL = {
    idealReaderPersona: "a", urgentPainPoint: "b", failedStatusQuo: "c", uniqueMechanism: "d",
    authorityProof: "e", clearActionPrompt: "f", riskReversal: "g",
};

describe("preflightStatus", () => {
    it("is ready only when all seven are answered", () => {
        expect(preflightStatus(FULL)).toEqual({ ready: true, answered: 7, missing: [] });
        expect(preflightStatus({ ...FULL, authorityProof: "   " })).toEqual({ ready: false, answered: 6, missing: ["authorityProof"] });
        expect(preflightStatus(null).answered).toBe(0);
        expect(preflightStatus(undefined).missing).toHaveLength(7);
    });
});

describe("sanitizePreflight", () => {
    it("keeps known answers, trims and clips them, and drops blanks and unknown keys", () => {
        const long = "x".repeat(MAX_PREFLIGHT_ANSWER_CHARS + 50);
        const result = sanitizePreflight({ idealReaderPersona: "  a founder ", urgentPainPoint: long, riskReversal: "  ", other: "ignored" });
        expect(result).toEqual({ idealReaderPersona: "a founder", urgentPainPoint: "x".repeat(MAX_PREFLIGHT_ANSWER_CHARS) });
    });

    it("refuses anything that is not an object of text", () => {
        expect(sanitizePreflight("text")).toBeNull();
        expect(sanitizePreflight(["a"])).toBeNull();
        expect(sanitizePreflight(null)).toBeNull();
        expect(sanitizePreflight({ idealReaderPersona: 5 })).toBeNull();
    });
});
