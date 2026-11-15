import { describe, expect, it } from "vitest";
import { evaluatePace, PACE_LIMITS, type PaceStep } from "./paceRules";
import {
    applyStrategyInput,
    findStrategy,
    guidanceFor,
    MAX_OBJECTIVE_CHARS,
    MAX_STRATEGIES,
    paceLimitsFor,
    parseStrategyInput,
    preflightFromConfig,
    sanitizeStrategies,
    SCORING_STRATEGY_IDS,
    STRATEGIES,
    strategiesFromConfig,
} from "./strategies";

describe("the registry", () => {
    it("has unique ids, leaves out Strategy 2, and gives every live strategy something to act on", () => {
        const ids = STRATEGIES.map((s) => s.id);
        expect(new Set(ids).size).toBe(ids.length);
        expect(ids).not.toContain("S2");
        expect(ids).toHaveLength(16);
        for (const s of STRATEGIES.filter((x) => x.live && x.group === "approach")) {
            expect(s.objective).toBeTruthy();
            expect(s.icp).toBeTruthy();
        }
        for (const s of STRATEGIES.filter((x) => x.live && x.group !== "approach")) expect(s.effect).toBeTruthy();
        for (const s of STRATEGIES.filter((x) => !x.live)) expect(s.group).not.toBe("approach");
    });
});

describe("sanitizeStrategies", () => {
    it("keeps live ids, drops repeats, and refuses anything else", () => {
        expect(sanitizeStrategies(["S1", "S3", "S1"])).toEqual(["S1", "S3"]);
        expect(sanitizeStrategies([])).toEqual([]);
        expect(sanitizeStrategies(["S1", "S4"])).toEqual(["S1", "S4"]);
        expect(sanitizeStrategies(["S9"])).toBeNull();
        expect(sanitizeStrategies(["S2"])).toBeNull();
        expect(sanitizeStrategies(["nope"])).toBeNull();
        expect(sanitizeStrategies([1])).toBeNull();
        expect(sanitizeStrategies("S1")).toBeNull();
        expect(sanitizeStrategies(["S1", "S3", "S6", "S10", "S11", "S1"].concat(["S1"]).slice(0, MAX_STRATEGIES + 1))).toBeNull();
    });
});

describe("pre-flight brief", () => {
    it("parses and stores the brief, and removes it when emptied", () => {
        const parsed = parseStrategyInput({ preflight: { urgentPainPoint: " slow replies " } });
        expect(parsed).toEqual({ ok: true, value: { preflight: { urgentPainPoint: "slow replies" } } });
        expect(parseStrategyInput({ preflight: 5 }).ok).toBe(false);

        const stored = applyStrategyInput({ tone: "x" }, { preflight: { urgentPainPoint: "slow replies" } });
        expect(stored).toEqual({ tone: "x", preflight: { urgentPainPoint: "slow replies" } });
        expect(applyStrategyInput(stored, { preflight: {} })).toEqual({ tone: "x" });
        expect(preflightFromConfig(stored)).toEqual({ urgentPainPoint: "slow replies" });
        expect(preflightFromConfig(null)).toEqual({});
    });
});

describe("scoring strategies", () => {
    it("are live, can be stored on a campaign, and each says what it adds", () => {
        for (const id of SCORING_STRATEGY_IDS) {
            expect(findStrategy(id)).toMatchObject({ live: true, group: "check" });
            expect(findStrategy(id)?.effect).toBeTruthy();
        }
        expect(sanitizeStrategies([...SCORING_STRATEGY_IDS])).toEqual([...SCORING_STRATEGY_IDS]);
    });
});

describe("paceLimitsFor", () => {
    it("is the defaults with no strategy, and for strategies that do not change pacing", () => {
        expect(paceLimitsFor([])).toEqual(PACE_LIMITS);
        expect(paceLimitsFor(null)).toEqual(PACE_LIMITS);
        expect(paceLimitsFor(["S1", "S6"])).toEqual(PACE_LIMITS);
    });

    it("applies a strategy's overrides, a later strategy winning where both set a limit", () => {
        expect(paceLimitsFor(["S3"])).toMatchObject({ minGapHours: 24, maxFirstWeekEmails: 7, maxEmails: 14 });
        expect(paceLimitsFor(["S3", "S11"])).toMatchObject({ minGapHours: 24, maxEmails: 10 });
        expect(paceLimitsFor(["S11", "S3"]).maxEmails).toBe(14);
    });

    it("changes what the pace check reports", () => {
        const daily: PaceStep[] = [0, 1, 1, 1].map((d, i) => ({ id: `e${i}`, stepType: "EMAIL", delayDays: d, delayHours: 0 }));
        expect(evaluatePace(daily).map((f) => f.ruleId)).toContain("email-gap");
        expect(evaluatePace(daily, paceLimitsFor(["S3"]))).toEqual([]);
    });
});

describe("guidanceFor", () => {
    it("suggests the first approach's objective and lists the ICP guidance of each approach", () => {
        const g = guidanceFor(["S10", "S11"]);
        expect(g.objective).toBe(findStrategy("S10")!.objective);
        expect(g.icp).toHaveLength(2);
    });

    it("has nothing for no strategy", () => {
        expect(guidanceFor([])).toEqual({ objective: null, icp: [] });
    });
});

describe("parseStrategyInput", () => {
    it("reads only the fields that are present", () => {
        expect(parseStrategyInput({ name: "x" })).toEqual({ ok: true, value: {} });
        expect(parseStrategyInput({ strategies: ["S1"], objective: "  Win  " })).toEqual({ ok: true, value: { strategies: ["S1"], objective: "Win" } });
    });

    it("clips a long objective and refuses bad input", () => {
        const parsed = parseStrategyInput({ objective: "x".repeat(MAX_OBJECTIVE_CHARS + 50) });
        expect(parsed.ok && parsed.value.objective).toHaveLength(MAX_OBJECTIVE_CHARS);
        expect(parseStrategyInput({ strategies: ["S9"] }).ok).toBe(false);
        expect(parseStrategyInput({ objective: 5 }).ok).toBe(false);
    });
});

describe("applyStrategyInput", () => {
    it("adds the strategies and the objective (stored as goal) without losing other settings", () => {
        expect(applyStrategyInput({ tone: "Direct" }, { strategies: ["S1"], objective: "Win" })).toEqual({ tone: "Direct", strategies: ["S1"], goal: "Win" });
    });

    it("clears the goal for an empty objective, leaves it alone when absent, and returns null when nothing is left", () => {
        expect(applyStrategyInput({ goal: "Old", tone: "Direct" }, { objective: "" })).toEqual({ tone: "Direct" });
        expect(applyStrategyInput({ goal: "Old" }, { strategies: [] })).toEqual({ goal: "Old", strategies: [] });
        expect(applyStrategyInput(null, {})).toBeNull();
        expect(applyStrategyInput({ goal: "Old" }, { objective: "" })).toBeNull();
    });
});

describe("strategiesFromConfig", () => {
    it("reads the stored list and ignores anything unusable", () => {
        expect(strategiesFromConfig({ strategies: ["S3"] })).toEqual(["S3"]);
        expect(strategiesFromConfig({ strategies: ["bogus"] })).toEqual([]);
        expect(strategiesFromConfig(null)).toEqual([]);
        expect(strategiesFromConfig("x")).toEqual([]);
    });
});
