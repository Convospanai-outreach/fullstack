import { describe, expect, it, vi, beforeEach } from "vitest";

const mockDb: any = vi.hoisted(() => ({
    lead: { findFirst: vi.fn(), updateMany: vi.fn() },
    leadActivity: { create: vi.fn() },
    team: { findUnique: vi.fn() },
    featureFlag: { findUnique: vi.fn().mockResolvedValue(null) },
}));
const tagFunnelStage = vi.hoisted(() => vi.fn());

vi.mock("@/lib/db", () => ({ prisma: mockDb }));
vi.mock("@/modules/mautic-integration/service/mauticService", () => ({ mauticService: { tagFunnelStage } }));

import { applyFunnelEvent, moveLeadToStage, STAGE_FOR_EVENT } from "../funnelStageService";
import { isCreatorFunnelEnabled } from "../featureGate";

const at = (stage: string | null) => mockDb.lead.findFirst.mockResolvedValue({ funnelStage: stage });

describe("funnelStageService", () => {
    beforeEach(() => {
        vi.clearAllMocks();
        mockDb.lead.updateMany.mockResolvedValue({ count: 1 });
        tagFunnelStage.mockResolvedValue({ status: "skipped" });
    });

    it("maps each named event to its stage", () => {
        expect(STAGE_FOR_EVENT).toEqual({
            social_first_touch: "TOFU",
            landing_opt_in: "MOFU",
            checkout_started: "BOFU",
            call_booked: "BOFU",
            payment_succeeded: "POST",
        });
    });

    it("moves forward, logs the change, and mirrors it to Mautic", async () => {
        at("TOFU");

        const change = await applyFunnelEvent("team-a", "lead-1", "landing_opt_in", "user-1");

        expect(change).toEqual({ changed: true, from: "TOFU", to: "MOFU" });
        expect(mockDb.lead.findFirst).toHaveBeenCalledWith({ where: { id: "lead-1", teamId: "team-a" }, select: { funnelStage: true } });
        expect(mockDb.lead.updateMany).toHaveBeenCalledWith({ where: { id: "lead-1", teamId: "team-a", funnelStage: "TOFU" }, data: { funnelStage: "MOFU" } });
        expect(mockDb.leadActivity.create).toHaveBeenCalledWith({
            data: {
                leadId: "lead-1",
                channel: "funnel",
                type: "stage_change",
                title: "Moved to MOFU",
                metadata: { from: "TOFU", to: "MOFU", reason: "landing_opt_in", forced: false },
                createdBy: "user-1",
            },
        });
        expect(tagFunnelStage).toHaveBeenCalledWith("lead-1", "team-a", "MOFU");
    });

    it("enters the funnel from no stage and can skip stages forward", async () => {
        at(null);
        expect(await applyFunnelEvent("team-a", "lead-1", "payment_succeeded")).toEqual({ changed: true, from: null, to: "POST" });
    });

    it("never jumps backward unless forced", async () => {
        at("BOFU");
        expect(await applyFunnelEvent("team-a", "lead-1", "landing_opt_in")).toEqual({ changed: false, from: "BOFU", to: "MOFU" });
        expect(mockDb.lead.updateMany).not.toHaveBeenCalled();
        expect(mockDb.leadActivity.create).not.toHaveBeenCalled();

        const forced = await moveLeadToStage({ teamId: "team-a", leadId: "lead-1", to: "MOFU", reason: "manual", force: true, actorUserId: "user-1" });
        expect(forced.changed).toBe(true);
        expect(mockDb.leadActivity.create.mock.calls[0][0].data.metadata).toMatchObject({ from: "BOFU", to: "MOFU", forced: true });
    });

    it("does nothing when the stage is unchanged or a concurrent update won", async () => {
        at("MOFU");
        expect((await applyFunnelEvent("team-a", "lead-1", "landing_opt_in")).changed).toBe(false);
        expect(mockDb.lead.updateMany).not.toHaveBeenCalled();

        at("MOFU");
        mockDb.lead.updateMany.mockResolvedValue({ count: 0 });
        expect((await applyFunnelEvent("team-a", "lead-1", "checkout_started")).changed).toBe(false);
        expect(mockDb.leadActivity.create).not.toHaveBeenCalled();
    });

    it("rejects a lead outside the team", async () => {
        mockDb.lead.findFirst.mockResolvedValue(null);
        await expect(applyFunnelEvent("team-a", "lead-x", "landing_opt_in")).rejects.toThrow("Lead not found");
    });
});

describe("isCreatorFunnelEnabled", () => {
    it("is on only when the team explicitly enabled it", async () => {
        mockDb.team.findUnique.mockResolvedValueOnce({ enabledFeatures: ["workflows", "creator-funnel"] });
        expect(await isCreatorFunnelEnabled("team-a")).toBe(true);

        mockDb.team.findUnique.mockResolvedValueOnce({ enabledFeatures: ["workflows"] });
        expect(await isCreatorFunnelEnabled("team-a")).toBe(false);

        mockDb.team.findUnique.mockResolvedValueOnce({ enabledFeatures: null });
        expect(await isCreatorFunnelEnabled("team-a")).toBe(false);
    });

    it("is off for every team when the superadmin switches it off platform-wide", async () => {
        mockDb.team.findUnique.mockResolvedValueOnce({ enabledFeatures: ["creator-funnel"] });
        mockDb.featureFlag.findUnique.mockResolvedValueOnce({ isEnabled: false });
        expect(await isCreatorFunnelEnabled("team-a")).toBe(false);
        expect(mockDb.featureFlag.findUnique).toHaveBeenCalledWith({ where: { key: "hidden_feature:creator-funnel" }, select: { isEnabled: true } });
    });
});
