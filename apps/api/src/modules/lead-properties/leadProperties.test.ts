import { describe, expect, it } from "vitest";
import {
    applyCustomFieldsPatch,
    coercePropertyValue,
    MAX_CUSTOM_FIELDS_CHARS,
    MAX_PROPERTY_VALUE_CHARS,
    pickPropertyAnswers,
    validatePropertyDefinition,
    validatePropertyKey,
    type PropertyDefinition,
} from "./leadProperties";

const budget: PropertyDefinition = { key: "budget", type: "number", options: null, archivedAt: null };
const plan: PropertyDefinition = { key: "plan", type: "choice", options: ["starter", "pro"], archivedAt: null };
const consent: PropertyDefinition = { key: "consent", type: "yesno", options: null, archivedAt: null };
const startDate: PropertyDefinition = { key: "start_date", type: "date", options: null, archivedAt: null };
const notes: PropertyDefinition = { key: "notes", type: "text", options: null, archivedAt: null };
const oldCode: PropertyDefinition = { key: "old_code", type: "text", options: null, archivedAt: new Date("2026-10-01") };
const defs = [budget, plan, consent, startDate, notes, oldCode];

describe("validatePropertyKey", () => {
    it("accepts lowercase slugs up to 32 characters", () => {
        expect(validatePropertyKey("budget")).toBeNull();
        expect(validatePropertyKey("start_date_2")).toBeNull();
        expect(validatePropertyKey("a".repeat(32))).toBeNull();
    });

    it("rejects bad slugs, too-long keys and reserved lead columns", () => {
        expect(validatePropertyKey("Budget")).not.toBeNull();
        expect(validatePropertyKey("1budget")).not.toBeNull();
        expect(validatePropertyKey("has space")).not.toBeNull();
        expect(validatePropertyKey("a".repeat(33))).not.toBeNull();
        for (const reserved of ["name", "email", "phone", "company", "title", "website"]) {
            expect(validatePropertyKey(reserved)).not.toBeNull();
        }
    });
});

describe("validatePropertyDefinition", () => {
    it("requires options for choice and forbids them for other types", () => {
        expect(validatePropertyDefinition({ key: "plan", label: "Plan", type: "choice", options: ["a", "b"] }).ok).toBe(true);
        expect(validatePropertyDefinition({ key: "plan", label: "Plan", type: "choice", options: [] }).ok).toBe(false);
        expect(validatePropertyDefinition({ key: "plan", label: "Plan", type: "choice", options: ["a", "a"] }).ok).toBe(false);
        expect(validatePropertyDefinition({ key: "budget", label: "Budget", type: "number", options: ["x"] }).ok).toBe(false);
    });

    it("rejects unknown types and empty labels", () => {
        expect(validatePropertyDefinition({ key: "x", label: "X", type: "select", options: null }).ok).toBe(false);
        expect(validatePropertyDefinition({ key: "x", label: "  ", type: "text", options: null }).ok).toBe(false);
    });
});

describe("coercePropertyValue", () => {
    it("text: trims, rejects empty and over-long values", () => {
        expect(coercePropertyValue(notes, "  hello ")).toEqual({ ok: true, value: "hello" });
        expect(coercePropertyValue(notes, "   ").ok).toBe(false);
        expect(coercePropertyValue(notes, "x".repeat(MAX_PROPERTY_VALUE_CHARS + 1)).ok).toBe(false);
        expect(coercePropertyValue(notes, 42).ok).toBe(false);
    });

    it("number: accepts numbers and numeric strings, rejects NaN, Infinity and text", () => {
        expect(coercePropertyValue(budget, 5000)).toEqual({ ok: true, value: 5000 });
        expect(coercePropertyValue(budget, "12.5")).toEqual({ ok: true, value: 12.5 });
        expect(coercePropertyValue(budget, "-3")).toEqual({ ok: true, value: -3 });
        expect(coercePropertyValue(budget, "abc").ok).toBe(false);
        expect(coercePropertyValue(budget, "").ok).toBe(false);
        expect(coercePropertyValue(budget, Number.NaN).ok).toBe(false);
        expect(coercePropertyValue(budget, Number.POSITIVE_INFINITY).ok).toBe(false);
        expect(coercePropertyValue(budget, true).ok).toBe(false);
    });

    it("choice: only accepts one of the defined options", () => {
        expect(coercePropertyValue(plan, "pro")).toEqual({ ok: true, value: "pro" });
        expect(coercePropertyValue(plan, "enterprise").ok).toBe(false);
        expect(coercePropertyValue(plan, 1).ok).toBe(false);
    });

    it("yesno: accepts booleans and the strings true/false only", () => {
        expect(coercePropertyValue(consent, true)).toEqual({ ok: true, value: true });
        expect(coercePropertyValue(consent, "false")).toEqual({ ok: true, value: false });
        expect(coercePropertyValue(consent, "yes").ok).toBe(false);
        expect(coercePropertyValue(consent, 1).ok).toBe(false);
    });

    it("date: accepts real calendar dates in YYYY-MM-DD form only", () => {
        expect(coercePropertyValue(startDate, "2026-11-30")).toEqual({ ok: true, value: "2026-11-30" });
        expect(coercePropertyValue(startDate, "2026-02-30").ok).toBe(false);
        expect(coercePropertyValue(startDate, "30/11/2026").ok).toBe(false);
        expect(coercePropertyValue(startDate, "2026-11-30T10:00:00Z").ok).toBe(false);
    });
});

describe("applyCustomFieldsPatch", () => {
    it("merges valid values over existing ones and keeps keys not in the patch", () => {
        const result = applyCustomFieldsPatch(defs, { plan: "starter", notes: "old" }, { notes: "new", budget: 10 });
        expect(result).toEqual({ ok: true, value: { plan: "starter", notes: "new", budget: 10 } });
    });

    it("removes a key when the patch value is null", () => {
        const result = applyCustomFieldsPatch(defs, { plan: "starter", notes: "x" }, { plan: null });
        expect(result).toEqual({ ok: true, value: { notes: "x" } });
    });

    it("rejects unknown keys and archived keys", () => {
        expect(applyCustomFieldsPatch(defs, {}, { nope: "x" }).ok).toBe(false);
        expect(applyCustomFieldsPatch(defs, {}, { old_code: "x" }).ok).toBe(false);
    });

    it("rejects a wrong type without changing anything", () => {
        expect(applyCustomFieldsPatch(defs, {}, { budget: "lots" }).ok).toBe(false);
    });

    it("rejects a merged object over the size cap", () => {
        const big = "x".repeat(MAX_PROPERTY_VALUE_CHARS);
        const existing = Object.fromEntries(
            Array.from({ length: 9 }, (_, i) => [`k${i}`, big]),
        );
        const result = applyCustomFieldsPatch(defs, existing, { notes: big, plan: "pro" });
        expect(JSON.stringify(existing).length).toBeLessThan(MAX_CUSTOM_FIELDS_CHARS);
        expect(result.ok).toBe(false);
    });
});

describe("pickPropertyAnswers", () => {
    it("coerces answers whose keys match an active property and reports the bad ones", () => {
        const result = pickPropertyAnswers(defs, { budget: "250", plan: "gold", extra: "not a property", notes: "hi" });
        expect(result.values).toEqual({ budget: 250, notes: "hi" });
        expect(result.errors).toEqual([{ key: "plan", message: expect.any(String) }]);
    });

    it("ignores archived properties and answers without a definition", () => {
        const result = pickPropertyAnswers(defs, { old_code: "abc" });
        expect(result).toEqual({ values: {}, errors: [] });
    });
});
