import { describe, expect, it } from "vitest";
import { conversionText, editedText, statusLabel, verdictMessage } from "./landingExperimentCopy";
import type { ExperimentResults } from "@/modules/landing-agent/service/landingExperimentApi";

function results(overrides: Partial<ExperimentResults["verdict"]>, visitors = { A: 1000, B: 1000 }): ExperimentResults {
    return {
        experimentId: "exp-1",
        status: "running",
        variants: {
            A: { visitors: visitors.A, formStarts: 0, leads: 100, conversionRate: 0.1 },
            B: { visitors: visitors.B, formStarts: 0, leads: 130, conversionRate: 0.13 },
        },
        verdict: {
            status: "clear_winner",
            winner: "B",
            readiness: "ready",
            difference: 0.03,
            confidence: 96.45,
            rateA: 0.1,
            rateB: 0.13,
            ...overrides,
        },
    };
}

describe("statusLabel", () => {
    it("names each state in plain words", () => {
        expect(statusLabel("draft")).toBe("Draft");
        expect(statusLabel("running")).toBe("Running");
        expect(statusLabel("paused")).toBe("Paused");
        expect(statusLabel("ended")).toBe("Ended");
    });
});

describe("conversionText", () => {
    it("shows the rate with one decimal", () => {
        expect(conversionText(0.13)).toBe("13.0%");
        expect(conversionText(0.1)).toBe("10.0%");
    });
});

describe("verdictMessage", () => {
    it("says not enough data, with the visitor counts, until each page has 100 visitors", () => {
        const text = verdictMessage(results({ status: "not_enough_data", winner: null, readiness: "not_enough_visitors" }, { A: 50, B: 1000 }));
        expect(text).toContain("Not enough data yet");
        expect(text).toContain("A has 50");
    });

    it("says not enough data until the test has run 3 days", () => {
        const text = verdictMessage(results({ status: "not_enough_data", winner: null, readiness: "not_enough_days" }));
        expect(text).toContain("3 days");
    });

    it("never names a winner below 95% confidence", () => {
        const text = verdictMessage(results({ status: "no_clear_difference", winner: null, confidence: 16.1 }));
        expect(text).toContain("No clear winner yet");
        expect(text).toContain("16%");
        expect(text).not.toContain("ahead");
    });

    it("names the leading variant at 95% or more, rounding the confidence down", () => {
        const text = verdictMessage(results({}));
        expect(text).toContain("Variant B is ahead with 96% confidence");
    });
});

describe("editedText", () => {
    it("says which page was edited and when", () => {
        expect(editedText("B", "2026-11-05T10:00:00Z")).toBe(`Page B was edited on ${new Date("2026-11-05T10:00:00Z").toLocaleDateString()}`);
    });

    it("says nothing when the page was not edited during the test", () => {
        expect(editedText("A", null)).toBeNull();
    });
});
