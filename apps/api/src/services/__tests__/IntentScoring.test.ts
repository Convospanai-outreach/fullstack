import { vi, Mock, beforeEach, describe, it, expect } from "vitest";
import { IntentScoringService } from "../IntentScoring";
import { prisma } from "@/lib/db";
import { NotificationDispatcher } from "@/lib/notifications";

vi.mock("@/lib/db", () => ({
    prisma: {
        user: {
            findMany: vi.fn(),
        },
    },
}));

vi.mock("@/lib/notifications", () => ({
    NotificationDispatcher: {
        send: vi.fn(),
    },
}));

vi.mock("@/lib/aiService", () => ({
    aiService: {
        askAI: vi.fn(),
    },
}));

global.fetch = vi.fn() as Mock;

describe("IntentScoringService.processWebhookData", () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it("dispatches a SYSTEM notification to every ADMIN user when friction score exceeds 80", async () => {
        (global.fetch as Mock).mockResolvedValueOnce({
            ok: true,
            json: async () => ({ score: 95 }),
        });
        (prisma.user.findMany as Mock).mockResolvedValueOnce([
            { id: "admin-1" },
            { id: "admin-2" },
        ]);

        const service = new IntentScoringService();
        await service.processWebhookData({ content: "furious, get me a refund now" });

        expect(prisma.user.findMany).toHaveBeenCalledWith({ where: { role: "ADMIN" } });
        expect(NotificationDispatcher.send).toHaveBeenCalledTimes(2);
        expect(NotificationDispatcher.send).toHaveBeenCalledWith(
            "admin-1",
            "SYSTEM",
            "High Friction Detected",
            "High Karmic Friction Detected (Score: 95.0)",
            expect.objectContaining({ source: "Scraper Webhook", score: 95 })
        );
    });

    it("does not dispatch a notification when friction score is at or below 80", async () => {
        (global.fetch as Mock).mockResolvedValueOnce({
            ok: true,
            json: async () => ({ score: 50 }),
        });

        const service = new IntentScoringService();
        await service.processWebhookData({ content: "looking forward to the demo" });

        expect(prisma.user.findMany).not.toHaveBeenCalled();
        expect(NotificationDispatcher.send).not.toHaveBeenCalled();
    });
});
