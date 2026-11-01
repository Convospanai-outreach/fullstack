import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const { mockFind } = vi.hoisted(() => ({ mockFind: vi.fn() }));
vi.mock("@/lib/db", () => ({ prisma: { landingCampaign: { findFirst: mockFind } } }));

import { loadCampaignBrief, renderCampaignBrief } from "../copyBrief";

const saved = { ...process.env };
beforeEach(() => {
    vi.clearAllMocks();
    process.env["COPY_BRIEF"] = "on";
});
afterEach(() => {
    process.env = { ...saved };
});

describe("loadCampaignBrief", () => {
    it("is off by default and queries nothing", async () => {
        delete process.env["COPY_BRIEF"];
        expect(await loadCampaignBrief("c1", "t1")).toBe("");
        expect(mockFind).not.toHaveBeenCalled();
    });

    it("reads the landing campaign linked to this campaign, within the team", async () => {
        mockFind.mockResolvedValue({ challenge: "challenge-x", solution: "solution-x", benefit: "benefit-x" });
        const text = await loadCampaignBrief("c1", "t1");
        expect(mockFind).toHaveBeenCalledWith(expect.objectContaining({ where: { linkedCampaignId: "c1", teamId: "t1" } }));
        expect(text).toBe("Problem: challenge-x\nApproach: solution-x\nPromise: benefit-x");
    });

    it("returns nothing without a campaign, without a link, or when the lookup fails", async () => {
        expect(await loadCampaignBrief(undefined, "t1")).toBe("");
        mockFind.mockResolvedValue(null);
        expect(await loadCampaignBrief("c1", "t1")).toBe("");
        mockFind.mockRejectedValue(new Error("db down"));
        expect(await loadCampaignBrief("c1", "t1")).toBe("");
    });
});

describe("renderCampaignBrief", () => {
    it("skips empty parts and truncates long ones", () => {
        expect(renderCampaignBrief({ challenge: " ", solution: null, benefit: "b" })).toBe("Promise: b");
        expect(renderCampaignBrief({ challenge: "x".repeat(900) }).length).toBeLessThan(430);
    });
});
