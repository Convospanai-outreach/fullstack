import { describe, expect, it } from "vitest";
import { isAffirmative } from "./consentCell";

describe("isAffirmative (a CSV consent cell)", () => {
    it.each(["yes", "Yes", " Y ", "TRUE", "true", "1", "consented", "opted in", "opt-in", "granted"])("reads %j as consent given", (v) => {
        expect(isAffirmative(v)).toBe(true);
    });

    it.each(["", "  ", "no", "N", "false", "0", "unknown", "pending", "not consented", "no consent", "maybe", undefined, null])("reads %j as no consent", (v) => {
        expect(isAffirmative(v as any)).toBe(false);
    });
});
