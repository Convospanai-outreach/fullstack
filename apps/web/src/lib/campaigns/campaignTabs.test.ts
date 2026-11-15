import { describe, expect, it } from "vitest";
import { CAMPAIGN_TABS, tabFromQuery } from "./campaignTabs";

describe("tabFromQuery", () => {
    it("opens the tab named in the query when it is one of the campaign tabs", () => {
        expect(tabFromQuery("sequence")).toBe("sequence");
        expect(tabFromQuery("leads")).toBe("leads");
    });

    it("falls back to the overview for a missing or unknown tab", () => {
        expect(tabFromQuery(null)).toBe("overview");
        expect(tabFromQuery("")).toBe("overview");
        expect(tabFromQuery("admin")).toBe("overview");
    });

    it("lists the six tabs the campaign page renders", () => {
        expect(CAMPAIGN_TABS).toEqual(["overview", "sequence", "leads", "activity", "timeline", "analytics"]);
    });
});
