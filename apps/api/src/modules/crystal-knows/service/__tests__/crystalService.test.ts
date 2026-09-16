import { beforeEach, describe, expect, it, vi } from "vitest";

const { mockGetTeamCrystalApiKey } = vi.hoisted(() => ({
    mockGetTeamCrystalApiKey: vi.fn(),
}));

vi.mock("../../crystalCredentials", () => ({
    getTeamCrystalApiKey: mockGetTeamCrystalApiKey,
}));

import { CrystalService } from "../crystalService";

describe("CrystalService.findOrCreateProfile", () => {
    beforeEach(() => {
        vi.clearAllMocks();
        vi.stubGlobal("fetch", vi.fn());
    });

    it("returns not_configured when the team has no Crystal API key", async () => {
        mockGetTeamCrystalApiKey.mockResolvedValue(undefined);

        const result = await CrystalService.findOrCreateProfile("team-1", { full_name: "Jane Doe" }, { recordId: "lead:1" });

        expect(result).toEqual({ state: "not_configured" });
        expect(fetch).not.toHaveBeenCalled();
    });

    it("returns found immediately on a GET /v4/profile hit, without submitting a prediction", async () => {
        mockGetTeamCrystalApiKey.mockResolvedValue("sk-1");
        (fetch as any).mockResolvedValue({
            ok: true,
            status: 200,
            json: async () => ({ data: { id: "profile-1", first_name: "Jane" } }),
        });

        const result = await CrystalService.findOrCreateProfile("team-1", { full_name: "Jane Doe" }, { recordId: "lead:1" });

        expect(result).toEqual({ state: "found", profile: { id: "profile-1", first_name: "Jane" } });
        expect(fetch).toHaveBeenCalledTimes(1);
    });

    it("submits a prediction and polls to a found result when the profile isn't already known", async () => {
        mockGetTeamCrystalApiKey.mockResolvedValue("sk-1");
        (fetch as any)
            .mockResolvedValueOnce({ ok: false, status: 404, json: async () => ({ error: "not found" }) })
            .mockResolvedValueOnce({ ok: true, status: 202, json: async () => ({ job_id: "job-1", status: "queued" }) })
            .mockResolvedValueOnce({
                ok: true,
                status: 200,
                json: async () => ({
                    job_id: "job-1",
                    status: "completed",
                    result: { state: "found", profile: { id: "profile-2" }, error: null },
                }),
            });

        const result = await CrystalService.findOrCreateProfile(
            "team-1",
            { full_name: "Jane Doe" },
            { recordId: "lead:1", pollIntervalMs: 1 }
        );

        expect(result).toEqual({ state: "found", profile: { id: "profile-2" } });
    });

    it("returns not_found when the prediction job completes with no match", async () => {
        mockGetTeamCrystalApiKey.mockResolvedValue("sk-1");
        (fetch as any)
            .mockResolvedValueOnce({ ok: false, status: 404, json: async () => ({ error: "not found" }) })
            .mockResolvedValueOnce({ ok: true, status: 202, json: async () => ({ job_id: "job-1", status: "queued" }) })
            .mockResolvedValueOnce({
                ok: true,
                status: 200,
                json: async () => ({ job_id: "job-1", status: "completed", result: { state: "not_found", profile: null, error: null } }),
            });

        const result = await CrystalService.findOrCreateProfile(
            "team-1",
            { full_name: "Jane Doe" },
            { recordId: "lead:1", pollIntervalMs: 1 }
        );

        expect(result).toEqual({ state: "not_found" });
    });

    it("returns pending with the job id when the poll window expires before completion", async () => {
        mockGetTeamCrystalApiKey.mockResolvedValue("sk-1");
        (fetch as any)
            .mockResolvedValueOnce({ ok: false, status: 404, json: async () => ({ error: "not found" }) })
            .mockResolvedValueOnce({ ok: true, status: 202, json: async () => ({ job_id: "job-1", status: "queued" }) })
            .mockResolvedValue({ ok: true, status: 200, json: async () => ({ job_id: "job-1", status: "processing", result: null }) });

        const result = await CrystalService.findOrCreateProfile(
            "team-1",
            { full_name: "Jane Doe" },
            { recordId: "lead:1", maxWaitMs: 5, pollIntervalMs: 1 }
        );

        expect(result).toEqual({ state: "pending", jobId: "job-1" });
    });
});

describe("CrystalService.generatePersonalityPrompt", () => {
    beforeEach(() => {
        vi.clearAllMocks();
        vi.stubGlobal("fetch", vi.fn());
    });

    it("returns null without calling the API when neither id nor discType is given", async () => {
        mockGetTeamCrystalApiKey.mockResolvedValue("sk-1");
        const result = await CrystalService.generatePersonalityPrompt("team-1", {});
        expect(result).toBeNull();
        expect(fetch).not.toHaveBeenCalled();
    });

    it("returns the generated prompt on success", async () => {
        mockGetTeamCrystalApiKey.mockResolvedValue("sk-1");
        (fetch as any).mockResolvedValue({
            ok: true,
            status: 200,
            json: async () => ({ prompt: "Be direct.", disc_type: "D", archetype: "Driver", guidance: {} }),
        });

        const result = await CrystalService.generatePersonalityPrompt("team-1", { id: "profile-1", objective: "follow up" });
        expect(result).toBe("Be direct.");
    });

    it("returns null (best-effort) when the API call fails", async () => {
        mockGetTeamCrystalApiKey.mockResolvedValue("sk-1");
        (fetch as any).mockResolvedValue({ ok: false, status: 500, json: async () => ({ error: "boom" }) });

        const result = await CrystalService.generatePersonalityPrompt("team-1", { id: "profile-1" });
        expect(result).toBeNull();
    });
});
