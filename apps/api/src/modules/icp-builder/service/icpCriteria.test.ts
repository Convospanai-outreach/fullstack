import { describe, expect, it } from "vitest";
import { parseGeographies, readIcpCriteria } from "./icpCriteria";

describe("readIcpCriteria", () => {
    it("reads the ICP builder shape", () => {
        expect(readIcpCriteria({ industry: "FinTech", role: "CTO, VP Eng", size: "51-200", geographies: ["India", "UAE"] })).toMatchObject({
            industries: ["FinTech"], roles: ["CTO", "VP Eng"], size: "51-200", geographies: ["India", "UAE"],
        });
    });
    it("reads the agent and matcher shapes", () => {
        expect(readIcpCriteria({ industries: ["Retail"], buyerTitles: ["COO"], companySizes: ["201-500"] })).toMatchObject({ industries: ["Retail"], roles: ["COO"], size: "201-500" });
        expect(readIcpCriteria({ jobTitles: ["VP Sales"], companySize: { min: 50, max: 500 } })).toMatchObject({ roles: ["VP Sales"], size: "50-500 employees" });
    });
    it("splits a typed geography string and tolerates junk", () => {
        expect(readIcpCriteria({ geographies: "India, UK; Germany" }).geographies).toEqual(["India", "UK", "Germany"]);
        expect(parseGeographies("India, UK; Germany")).toEqual(["India", "UK", "Germany"]);
        expect(readIcpCriteria(null)).toMatchObject({ industries: [], roles: [], geographies: [] });
        expect(readIcpCriteria({ jobTitles: 5, companySize: "big" }).roles).toEqual([]);
    });
});
