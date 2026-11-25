import { beforeEach, describe, expect, it, vi } from "vitest";
import { accountReplyHoldUntil } from "../accountReplyCooldown";

const { findFirst } = vi.hoisted(() => ({ findFirst: vi.fn() }));
vi.mock("@/lib/db", () => ({ prisma: { message: { findFirst } } }));

const now = new Date("2026-11-25T10:00:00Z");
const input = { teamId: "team-a", leadId: "lead-a", domain: "www.example.com", settings: { accountReplyCooldownHours: 24 }, now };

describe("account reply cooldown", () => {
    beforeEach(() => vi.resetAllMocks());

    it("holds sends until the latest reply by another contact at the same team account expires", async () => {
        const yesterday = new Date("2026-11-24T10:00:00Z");
        findFirst.mockResolvedValue({ createdAt: new Date("2026-11-25T08:00:00Z") });
        await expect(accountReplyHoldUntil(input)).resolves.toEqual(new Date("2026-11-26T08:00:00Z"));
        expect(findFirst).toHaveBeenCalledWith(expect.objectContaining({ where: {
            direction: "INBOUND", platform: "EMAIL", createdAt: { gt: yesterday, lte: now },
            lead: { teamId: "team-a", domain: { equals: "example.com", mode: "insensitive" }, id: { not: "lead-a" } },
        } }));
    });

    it("does not look for collisions when disabled or on a shared mailbox domain", async () => {
        await expect(accountReplyHoldUntil({ ...input, settings: null })).resolves.toBeNull();
        await expect(accountReplyHoldUntil({ ...input, domain: "gmail.com" })).resolves.toBeNull();
        expect(findFirst).not.toHaveBeenCalled();
    });
});
