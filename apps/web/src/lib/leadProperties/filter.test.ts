import { describe, expect, it } from "vitest";
import { leadPropertyFilterWhere } from "./filter";

const text = { key: "notes", type: "text", options: null };
const number = { key: "budget", type: "number", options: null };
const yesno = { key: "consent", type: "yesno", options: null };
const date = { key: "start_date", type: "date", options: null };
const choice = { key: "plan", type: "choice", options: ["starter", "pro"] };

describe("leadPropertyFilterWhere", () => {
    it("equals matches the stored JSON value of the property's type", () => {
        expect(leadPropertyFilterWhere(text, "equals", "hi")).toEqual({ ok: true, where: { customFields: { path: ["notes"], equals: "hi" } } });
        expect(leadPropertyFilterWhere(number, "equals", "12.5")).toEqual({ ok: true, where: { customFields: { path: ["budget"], equals: 12.5 } } });
        expect(leadPropertyFilterWhere(yesno, "equals", "false")).toEqual({ ok: true, where: { customFields: { path: ["consent"], equals: false } } });
        expect(leadPropertyFilterWhere(date, "equals", "2026-11-30")).toEqual({ ok: true, where: { customFields: { path: ["start_date"], equals: "2026-11-30" } } });
        expect(leadPropertyFilterWhere(choice, "equals", "pro")).toEqual({ ok: true, where: { customFields: { path: ["plan"], equals: "pro" } } });
    });

    it("refuses a value that cannot be the property's type", () => {
        expect(leadPropertyFilterWhere(number, "equals", "abc").ok).toBe(false);
        expect(leadPropertyFilterWhere(yesno, "equals", "maybe").ok).toBe(false);
        expect(leadPropertyFilterWhere(date, "equals", "2026-02-30").ok).toBe(false);
        expect(leadPropertyFilterWhere(choice, "equals", "gold").ok).toBe(false);
    });

    it("contains works on text only, as a case-sensitive substring", () => {
        expect(leadPropertyFilterWhere(text, "contains", "urgent")).toEqual({
            ok: true,
            where: { customFields: { path: ["notes"], string_contains: "urgent" } },
        });
        expect(leadPropertyFilterWhere(number, "contains", "1").ok).toBe(false);
        expect(leadPropertyFilterWhere(choice, "contains", "pr").ok).toBe(false);
    });

    it("refuses an unknown operator, an empty or over-long value", () => {
        expect(leadPropertyFilterWhere(text, "starts_with", "x").ok).toBe(false);
        expect(leadPropertyFilterWhere(text, "equals", "").ok).toBe(false);
        expect(leadPropertyFilterWhere(text, "equals", "x".repeat(201)).ok).toBe(false);
    });
});
