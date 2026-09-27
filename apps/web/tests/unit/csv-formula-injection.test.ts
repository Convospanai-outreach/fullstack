import { readFileSync } from "fs";
import path from "path";
import { describe, expect, it } from "vitest";
import { neutralizeCsvFormula } from "@/lib/csvFormula";

// Roadmap 3.5 / S-14: CSVs apps/web builds in the browser.

describe("neutralizeCsvFormula", () => {
    it.each(["=1+1", "+1", "-1+2", "@SUM(A1)", "\t=1", "\r=1", "=1+1\nx"])("prefixes %j with an apostrophe", (value) => {
        expect(neutralizeCsvFormula(value)).toBe(`'${value}`);
    });

    it.each(["Acme", "j@a.com", "1-2", "", " =1"])("leaves %j alone", (value) => {
        expect(neutralizeCsvFormula(value)).toBe(value);
    });
});

// These exports live inside client components with no render harness in
// tests/unit, so guard the wiring structurally (same approach as sentry-wiring.test.ts).
describe("client-side CSV exports use the guard", () => {
    const read = (rel: string) => readFileSync(path.resolve(__dirname, "../../src", rel), "utf8");

    it("admin audit log export quotes and neutralizes every cell", () => {
        const src = read("app/(dashboard)/admin/audit/page.tsx");
        expect(src).toContain('import { neutralizeCsvFormula } from "@/lib/csvFormula";');
        expect(src).toContain("row.map(cell => `\"${neutralizeCsvFormula(String(cell ?? \"\")).replace(/\"/g, '\"\"')}\"`)");
    });

    it("ROI report export uses the shared guard (which also covers tab and CR)", () => {
        const src = read("app/(dashboard)/analytics/roi/page.tsx");
        expect(src).toContain('import { neutralizeCsvFormula } from "@/lib/csvFormula";');
        expect(src).toContain("str = neutralizeCsvFormula(str);");
        expect(src).not.toContain("/^[=+\\-@]/");
    });
});
