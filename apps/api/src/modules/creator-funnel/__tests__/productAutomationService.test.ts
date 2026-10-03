import { beforeEach, describe, expect, it, vi } from "vitest";

const mockDb = vi.hoisted(() => ({
    product: { findFirst: vi.fn(), updateMany: vi.fn() },
    connectedMailbox: { findFirst: vi.fn(), findMany: vi.fn() },
    campaignSequence: { findFirst: vi.fn(), findMany: vi.fn() },
    order: { findMany: vi.fn() },
}));
vi.mock("@/lib/db", () => ({ prisma: mockDb }));

import { getAutomation, updateAutomation, updateAutomationSchema } from "../productAutomationService";

const stored = (over: Record<string, unknown> = {}) => ({
    id: "prod-1",
    teamId: "team-a",
    deliveryUrl: null,
    deliveryMailboxId: null,
    cartAbandonSequenceId: null,
    cartAbandonHours: null,
    postPurchaseSequenceId: null,
    automationsActive: false,
    automationsActivatedById: null,
    automationsActivatedAt: null,
    ...over,
});

describe("productAutomationService", () => {
    beforeEach(() => {
        vi.clearAllMocks();
        mockDb.product.findFirst.mockResolvedValue(stored());
        mockDb.product.updateMany.mockResolvedValue({ count: 1 });
        mockDb.connectedMailbox.findFirst.mockResolvedValue({ id: "mb-1" });
        mockDb.campaignSequence.findFirst.mockResolvedValue({ steps: [{ stepType: "email" }, { stepType: "delay" }] });
    });

    it("switching on checks the setup and records who approved it and when", async () => {
        await updateAutomation("team-a", "user-1", "prod-1", { deliveryUrl: "https://school.example/c", deliveryMailboxId: "mb-1", active: true });
        expect(mockDb.connectedMailbox.findFirst).toHaveBeenCalledWith({ where: { id: "mb-1", teamId: "team-a", status: "CONNECTED" }, select: { id: true } });
        expect(mockDb.product.updateMany).toHaveBeenCalledWith({
            where: { id: "prod-1", teamId: "team-a" },
            data: expect.objectContaining({
                deliveryUrl: "https://school.example/c",
                automationsActive: true,
                automationsActivatedById: "user-1",
                automationsActivatedAt: expect.any(Date),
            }),
        });
    });

    it("rejects setups that can't work", async () => {
        const bad = [
            { deliveryUrl: "http://school.example/c", deliveryMailboxId: "mb-1" },
            { deliveryUrl: "javascript:alert(1)", deliveryMailboxId: "mb-1" },
            { deliveryUrl: "https://school.example/c" },
            { cartAbandonSequenceId: "seq-1" },
            { active: true },
        ];
        for (const input of bad) {
            await expect(updateAutomation("team-a", "user-1", "prod-1", input)).rejects.toMatchObject({ status: 400 });
        }
        mockDb.connectedMailbox.findFirst.mockResolvedValue(null);
        await expect(updateAutomation("team-a", "user-1", "prod-1", { deliveryUrl: "https://s.example", deliveryMailboxId: "mb-x" })).rejects.toThrow("isn't connected");
        mockDb.campaignSequence.findFirst.mockResolvedValue({ steps: [{ stepType: "linkedin_message" }] });
        await expect(updateAutomation("team-a", "user-1", "prod-1", { cartAbandonSequenceId: "seq-1", cartAbandonHours: 4 })).rejects.toThrow("can't run");
        mockDb.campaignSequence.findFirst.mockResolvedValue(null);
        await expect(updateAutomation("team-a", "user-1", "prod-1", { cartAbandonSequenceId: "seq-other", cartAbandonHours: 4 })).rejects.toThrow("wasn't found");
        expect(mockDb.campaignSequence.findFirst).toHaveBeenCalledWith(expect.objectContaining({ where: { id: "seq-other", teamId: "team-a" } }));
        expect(mockDb.product.updateMany).not.toHaveBeenCalled();
    });

    it("an after-purchase sequence alone is enough to switch on, and is checked like the cart-abandon one", async () => {
        await updateAutomation("team-a", "user-1", "prod-1", { postPurchaseSequenceId: "seq-post", active: true });
        expect(mockDb.campaignSequence.findFirst).toHaveBeenCalledWith(expect.objectContaining({ where: { id: "seq-post", teamId: "team-a" } }));
        expect(mockDb.product.updateMany.mock.calls[0][0].data).toMatchObject({ postPurchaseSequenceId: "seq-post", automationsActive: true });

        mockDb.campaignSequence.findFirst.mockResolvedValue({ steps: [{ stepType: "whatsapp" }] });
        await expect(updateAutomation("team-a", "user-1", "prod-1", { postPurchaseSequenceId: "seq-post" })).rejects.toThrow("can't run");
    });

    it("edits while on keep the original approval; switching off always works", async () => {
        mockDb.product.findFirst.mockResolvedValue(stored({ automationsActive: true, deliveryUrl: "https://a.example", deliveryMailboxId: "gone" }));
        await updateAutomation("team-a", "user-2", "prod-1", { cartAbandonSequenceId: "seq-1", cartAbandonHours: 6 }).catch(() => undefined);
        expect(mockDb.product.updateMany).toHaveBeenCalledWith({ where: expect.anything(), data: expect.not.objectContaining({ automationsActivatedById: "user-2" }) });

        vi.clearAllMocks();
        mockDb.product.updateMany.mockResolvedValue({ count: 1 });
        mockDb.connectedMailbox.findFirst.mockResolvedValue(null);
        await updateAutomation("team-a", "user-2", "prod-1", { active: false });
        expect(mockDb.connectedMailbox.findFirst).not.toHaveBeenCalled();
        expect(mockDb.product.updateMany).toHaveBeenCalledWith({ where: { id: "prod-1", teamId: "team-a" }, data: { automationsActive: false } });
    });

    it("404s another team's product", async () => {
        mockDb.product.findFirst.mockResolvedValue(null);
        await expect(updateAutomation("team-b", "user-1", "prod-1", { active: false })).rejects.toMatchObject({ status: 404 });
        await expect(getAutomation("team-b", "prod-1")).rejects.toMatchObject({ status: 404 });
        expect(mockDb.product.findFirst).toHaveBeenCalledWith({ where: { id: "prod-1", teamId: "team-b" } });
    });

    it("lists the team's mailboxes and sequences, marking ones a nurture can't run", async () => {
        mockDb.connectedMailbox.findMany.mockResolvedValue([{ id: "mb-1", email: "me@x.com" }]);
        mockDb.campaignSequence.findMany.mockResolvedValue([
            { id: "seq-1", name: "Cart", steps: [{ stepType: "email" }] },
            { id: "seq-2", name: "LinkedIn", steps: [{ stepType: "linkedin_message" }] },
        ]);
        mockDb.order.findMany.mockResolvedValue([]);
        const result = await getAutomation("team-a", "prod-1");
        expect(result.sequences).toEqual([
            { id: "seq-1", name: "Cart", usable: true },
            { id: "seq-2", name: "LinkedIn", usable: false },
        ]);
        expect(mockDb.connectedMailbox.findMany).toHaveBeenCalledWith(expect.objectContaining({ where: { teamId: "team-a", status: "CONNECTED" } }));
    });

    it("bounds the cart-abandon wait to 1-168 hours", () => {
        expect(updateAutomationSchema.safeParse({ cartAbandonHours: 0 }).success).toBe(false);
        expect(updateAutomationSchema.safeParse({ cartAbandonHours: 169 }).success).toBe(false);
        expect(updateAutomationSchema.safeParse({ cartAbandonHours: 24 }).success).toBe(true);
    });
});
