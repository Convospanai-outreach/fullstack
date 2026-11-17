import { describe, expect, it } from "vitest";
import { evaluatePace, findingsForStep, PACE_LIMITS, type PaceStep } from "./paceRules";

let n = 0;
const email = (delayDays: number, delayHours = 0): PaceStep => ({ id: `e${++n}`, stepType: "EMAIL", delayDays, delayHours });
const other = (delayDays: number): PaceStep => ({ id: `o${++n}`, stepType: "CALL", delayDays, delayHours: 0 });
const ids = (steps: PaceStep[]) => steps.map((s) => s.id);
const rules = (steps: PaceStep[]) => evaluatePace(steps).map((f) => f.ruleId);

describe("evaluatePace", () => {
    it("has no findings for an empty drip, a single email, or a sensible one", () => {
        expect(evaluatePace([])).toEqual([]);
        expect(evaluatePace([email(0)])).toEqual([]);
        expect(rules([email(0), email(3), email(5), email(7)])).toEqual([]);
    });

    it("flags an email that follows the last one in under 2 days, and only that email", () => {
        const steps = [email(0), email(1), email(3)];
        const findings = evaluatePace(steps);
        expect(findings).toHaveLength(1);
        expect(findings[0]).toMatchObject({ ruleId: "email-gap", severity: "warning", stepIds: [steps[1]!.id] });
        expect(findings[0]!.message).toContain("1 day.");
    });

    it("allows exactly 2 days, and counts hours", () => {
        expect(rules([email(0), email(2)])).toEqual([]);
        expect(rules([email(0), email(0, 47)])).toEqual(["email-gap"]);
        expect(rules([email(0), email(1, 24)])).toEqual([]);
    });

    it("does not treat the delay before the first email as a gap", () => {
        expect(rules([email(0, 1)])).toEqual([]);
    });

    it("counts a delay on another step towards the next email's gap", () => {
        expect(rules([email(0), other(2), email(0)])).toEqual([]);
        expect(rules([email(0), other(1), email(0)])).toEqual(["email-gap"]);
    });

    it("flags a heavy first week, naming the emails past the limit", () => {
        const steps = [email(0), email(2), email(2), email(2)];
        const findings = evaluatePace(steps);
        expect(findings.map((f) => f.ruleId)).toEqual(["first-week-load"]);
        expect(findings[0]!.stepIds).toEqual([steps[3]!.id]);
        expect(rules([email(0), email(2), email(2), email(3)])).toEqual([]);
    });

    it("flags a drip with more emails than the limit", () => {
        const steps = Array.from({ length: PACE_LIMITS.maxEmails + 1 }, (_, i) => email(i === 0 ? 0 : 5));
        const findings = evaluatePace(steps);
        expect(findings.map((f) => f.ruleId)).toEqual(["email-count"]);
        expect(findings[0]!.stepIds).toEqual([steps[PACE_LIMITS.maxEmails]!.id]);
    });

    it("notes a gap that shrinks while still above the minimum", () => {
        const steps = [email(0), email(7), email(3)];
        const findings = evaluatePace(steps);
        expect(findings).toHaveLength(1);
        expect(findings[0]).toMatchObject({ ruleId: "shrinking-gaps", severity: "info", stepIds: [steps[2]!.id] });
    });

    it("flags a drip that runs past 90 days", () => {
        expect(rules([email(0), email(30), email(30), email(31)])).toEqual(["sequence-length"]);
        expect(rules([email(0), email(30), email(30), email(30)])).toEqual([]);
    });

    it("ignores non-email steps for the email rules", () => {
        expect(rules([other(0), other(0), other(0), other(0), other(0)])).toEqual([]);
    });
});

describe("findingsForStep", () => {
    it("returns only the findings that name the step", () => {
        const steps = [email(0), email(1)];
        const findings = evaluatePace(steps);
        expect(findingsForStep(findings, steps[1]!.id)).toHaveLength(1);
        expect(findingsForStep(findings, steps[0]!.id)).toEqual([]);
        expect(ids(steps)).toHaveLength(2);
    });
});
