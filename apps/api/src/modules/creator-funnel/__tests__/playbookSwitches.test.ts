import { beforeEach, describe, expect, it, vi } from "vitest";

const mockDb: any = vi.hoisted(() => ({
    playbookRun: { findFirst: vi.fn(), updateMany: vi.fn() },
    campaignSequence: { findFirst: vi.fn(), updateMany: vi.fn() },
    connectedMailbox: { findFirst: vi.fn() },
    product: { findFirst: vi.fn(), updateMany: vi.fn() },
    lead: { findFirst: vi.fn() },
}));
const nurture = vi.hoisted(() => ({ enrollInNurture: vi.fn(), status: vi.fn() }));
const flag = vi.hoisted(() => vi.fn());

vi.mock("@/lib/db", () => ({ prisma: mockDb }));
vi.mock("../featureGate", () => ({ isCreatorFunnelEnabled: flag }));
vi.mock("../nurtureProvider", async (importOriginal) => ({
    ...(await importOriginal<typeof import("../nurtureProvider")>()),
    enrollInNurture: nurture.enrollInNurture,
    teamNurtureProvider: async () => ({ status: nurture.status }),
}));

import { ContentPostError } from "../contentPostService";
import { enrollPlanNurture, setPlanNurture, useOnProduct } from "../playbookSwitches";

const TEAM = "team-a";
const readyRun = (over: Record<string, unknown> = {}) => ({
    id: "run-1", status: "READY", productId: "prod-1", nurtureCampaignId: "camp-n", cartAbandonCampaignId: "camp-c", postPurchaseCampaignId: "camp-p", ...over,
});
const emailSeq = (id: string) => ({ id, steps: [{ stepType: "EMAIL" }, { stepType: "EMAIL" }] });
const status = async (p: Promise<unknown>) => ((await p.catch((e) => e)) as ContentPostError).status;

describe("playbookSwitches", () => {
    beforeEach(() => {
        vi.clearAllMocks();
        mockDb.playbookRun.findFirst.mockResolvedValue(readyRun());
        mockDb.playbookRun.updateMany.mockResolvedValue({ count: 1 });
        mockDb.connectedMailbox.findFirst.mockResolvedValue({ id: "mb-1" });
        mockDb.campaignSequence.findFirst.mockImplementation(async ({ where }: any) => emailSeq(`seq-${where.campaignId}`));
        mockDb.product.findFirst.mockResolvedValue({ id: "prod-1", automationsActive: false });
        mockDb.product.updateMany.mockResolvedValue({ count: 1 });
        flag.mockResolvedValue(true);
        nurture.status.mockResolvedValue({ active: false });
        mockDb.lead.findFirst.mockResolvedValue({ funnelStage: "MOFU" });
    });

    describe("setPlanNurture", () => {
        it("switching on sets the team mailbox as sender and records who and when", async () => {
            expect(await setPlanNurture(TEAM, "user-1", "run-1", { active: true, mailboxId: "mb-1" })).toEqual({ active: true });
            expect(mockDb.connectedMailbox.findFirst).toHaveBeenCalledWith({ where: { id: "mb-1", teamId: TEAM, status: "CONNECTED" }, select: { id: true } });
            expect(mockDb.campaignSequence.updateMany).toHaveBeenCalledWith({ where: { id: "seq-camp-n", teamId: TEAM }, data: { senderMailboxIds: ["mb-1"] } });
            const data = mockDb.playbookRun.updateMany.mock.calls[0][0].data;
            expect(data.nurtureActivatedById).toBe("user-1");
            expect(data.nurtureActivatedAt).toBeInstanceOf(Date);
        });

        it("needs a finished plan, a connected mailbox and a sequence a nurture can run", async () => {
            mockDb.playbookRun.findFirst.mockResolvedValueOnce(readyRun({ status: "GENERATING" }));
            expect(await status(setPlanNurture(TEAM, "u", "run-1", { active: true, mailboxId: "mb-1" }))).toBe(409);
            expect(await status(setPlanNurture(TEAM, "u", "run-1", { active: true }))).toBe(400);
            mockDb.connectedMailbox.findFirst.mockResolvedValueOnce(null);
            expect(await status(setPlanNurture(TEAM, "u", "run-1", { active: true, mailboxId: "mb-x" }))).toBe(400);
            mockDb.campaignSequence.findFirst.mockResolvedValueOnce({ id: "seq", steps: [{ stepType: "whatsapp" }] });
            expect(await status(setPlanNurture(TEAM, "u", "run-1", { active: true, mailboxId: "mb-1" }))).toBe(400);
            mockDb.playbookRun.findFirst.mockResolvedValueOnce(null);
            expect(await status(setPlanNurture(TEAM, "u", "run-1", { active: false }))).toBe(404);
            expect(mockDb.playbookRun.updateMany).not.toHaveBeenCalled();
        });

        it("switching off clears it without other checks", async () => {
            expect(await setPlanNurture(TEAM, "u", "run-1", { active: false })).toEqual({ active: false });
            expect(mockDb.playbookRun.updateMany).toHaveBeenCalledWith({ where: { id: "run-1", teamId: TEAM }, data: { nurtureActivatedAt: null, nurtureActivatedById: null } });
        });
    });

    describe("useOnProduct", () => {
        it("fills only empty fields of a switched-off product, never switching it on", async () => {
            mockDb.product.updateMany.mockResolvedValueOnce({ count: 1 }).mockResolvedValueOnce({ count: 0 });
            expect(await useOnProduct(TEAM, "run-1", { mailboxId: "mb-1" })).toEqual({ cartAbandon: true, postPurchase: false });
            expect(mockDb.product.updateMany).toHaveBeenNthCalledWith(1, {
                where: { id: "prod-1", teamId: TEAM, automationsActive: false, cartAbandonSequenceId: null },
                data: { cartAbandonSequenceId: "seq-camp-c", cartAbandonHours: 2 },
            });
            expect(mockDb.product.updateMany).toHaveBeenNthCalledWith(2, {
                where: { id: "prod-1", teamId: TEAM, automationsActive: false, postPurchaseSequenceId: null },
                data: { postPurchaseSequenceId: "seq-camp-p" },
            });
            for (const [{ data }] of mockDb.product.updateMany.mock.calls) expect(data.automationsActive).toBeUndefined();
            expect(mockDb.campaignSequence.updateMany).toHaveBeenCalledWith({ where: { teamId: TEAM, id: { in: ["seq-camp-c", "seq-camp-p"] } }, data: { senderMailboxIds: ["mb-1"] } });
        });

        it("refuses a switched-on product and a plan without one", async () => {
            mockDb.product.findFirst.mockResolvedValueOnce({ id: "prod-1", automationsActive: true });
            expect(await status(useOnProduct(TEAM, "run-1", { mailboxId: "mb-1" }))).toBe(409);
            mockDb.playbookRun.findFirst.mockResolvedValueOnce(readyRun({ productId: null }));
            expect(await status(useOnProduct(TEAM, "run-1", { mailboxId: "mb-1" }))).toBe(409);
            expect(mockDb.product.updateMany).not.toHaveBeenCalled();
        });
    });

    describe("enrollPlanNurture", () => {
        const signUp = { teamId: TEAM, landingPageId: "lp-magnet" };

        it("enrolls a sign-up on the plan's lead-magnet page when the nurture is on", async () => {
            mockDb.playbookRun.findFirst.mockResolvedValue({ nurtureCampaignId: "camp-n" });
            expect(await enrollPlanNurture(signUp, "lead-1")).toBeNull();
            expect(mockDb.playbookRun.findFirst).toHaveBeenCalledWith(expect.objectContaining({
                where: { teamId: TEAM, leadMagnetPageId: "lp-magnet", nurtureActivatedAt: { not: null }, nurtureCampaignId: { not: null } },
            }));
            expect(nurture.enrollInNurture).toHaveBeenCalledWith(TEAM, "lead-1", "seq-camp-n");
        });

        it("skips another page or a switched-off plan, the flag off, a lead past nurture, or one already in a sequence", async () => {
            mockDb.playbookRun.findFirst.mockResolvedValue(null);
            expect(await enrollPlanNurture(signUp, "lead-1")).toMatch(/no switched-on plan/);
            mockDb.playbookRun.findFirst.mockResolvedValue({ nurtureCampaignId: "camp-n" });
            flag.mockResolvedValueOnce(false);
            expect(await enrollPlanNurture(signUp, "lead-1")).toMatch(/creator funnel is off/);
            mockDb.lead.findFirst.mockResolvedValueOnce({ funnelStage: "BOFU" });
            expect(await enrollPlanNurture(signUp, "lead-1")).toMatch(/past nurture/);
            nurture.status.mockResolvedValueOnce({ active: true });
            expect(await enrollPlanNurture(signUp, "lead-1")).toMatch(/already in a sequence/);
            expect(nurture.enrollInNurture).not.toHaveBeenCalled();
        });
    });
});
