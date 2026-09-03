import { describe, expect, it, vi, beforeEach } from "vitest";

vi.mock("@/lib/prisma", () => ({
    prisma: {
        lead: { findFirst: vi.fn(), findMany: vi.fn() },
        message: { findFirst: vi.fn(), findMany: vi.fn(), create: vi.fn(), update: vi.fn(), delete: vi.fn(), updateMany: vi.fn() },
    },
}));

import { prisma } from "@/lib/prisma";
import { InboxService } from "./inboxService";

describe("InboxService", () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    describe("saveDraft", () => {
        it("refuses to save a draft against a lead from another team", async () => {
            (prisma.lead.findFirst as any).mockResolvedValue(null);

            await expect(InboxService.saveDraft("lead-from-team-b", "hi", "Agent", "team-a")).rejects.toThrow("LEAD_NOT_FOUND");

            expect(prisma.lead.findFirst).toHaveBeenCalledWith({
                where: { id: "lead-from-team-b", teamId: "team-a" },
                select: { id: true },
            });
            expect(prisma.message.create).not.toHaveBeenCalled();
        });

        it("creates a draft for a lead in the caller's own team", async () => {
            (prisma.lead.findFirst as any).mockResolvedValue({ id: "lead-1" });
            (prisma.message.findFirst as any).mockResolvedValue(null);
            (prisma.message.create as any).mockResolvedValue({ id: "msg-1" });

            const result = await InboxService.saveDraft("lead-1", "hi", "Agent", "team-a");

            expect(result).toEqual({ id: "msg-1" });
        });
    });

    describe("discardDraft", () => {
        it("refuses to discard a draft belonging to another team's lead", async () => {
            (prisma.message.findFirst as any).mockResolvedValue(null);

            await expect(InboxService.discardDraft("draft-from-team-b", "team-a")).rejects.toThrow("DRAFT_NOT_FOUND");

            expect(prisma.message.findFirst).toHaveBeenCalledWith({
                where: { id: "draft-from-team-b", status: "draft", lead: { teamId: "team-a" } },
                select: { id: true },
            });
            expect(prisma.message.delete).not.toHaveBeenCalled();
        });

        it("discards a draft belonging to the caller's own team", async () => {
            (prisma.message.findFirst as any).mockResolvedValue({ id: "draft-1" });
            (prisma.message.delete as any).mockResolvedValue({ id: "draft-1" });

            await InboxService.discardDraft("draft-1", "team-a");

            expect(prisma.message.delete).toHaveBeenCalledWith({ where: { id: "draft-1" } });
        });
    });

    describe("sendMessage", () => {
        it("refuses to send a message to a lead from another team", async () => {
            (prisma.lead.findFirst as any).mockResolvedValue(null);

            await expect(InboxService.sendMessage("lead-from-team-b", "hi", "Agent", "team-a")).rejects.toThrow("LEAD_NOT_FOUND");

            expect(prisma.message.create).not.toHaveBeenCalled();
        });
    });
});
