import { describe, expect, it } from "vitest";
import { COMPANY_RESEARCH_CREDITS, researchCostLines } from "./companyResearch";

describe("researchCostLines", () => {
    it("states the per-company price, the free cache window and the worst case for the campaign", () => {
        const lines = researchCostLines(40).join(" ");
        expect(COMPANY_RESEARCH_CREDITS).toBe(1);
        expect(lines).toContain("1 credit per new company");
        expect(lines).toContain("14 days");
        expect(lines).toContain("up to 40 credits");
    });
    it("uses the singular for one credit and handles an empty campaign", () => {
        expect(researchCostLines(1).join(" ")).toContain("up to 1 credit ");
        expect(researchCostLines(0).join(" ")).not.toContain("up to");
    });
});
