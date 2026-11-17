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

const { mockJudgeFriction } = vi.hoisted(() => ({ mockJudgeFriction: vi.fn() }));
vi.mock("@/lib/ai/jev", () => ({ judgeFriction: mockJudgeFriction }));

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

    describe("when the edge node is unavailable", () => {
        beforeEach(() => {
            (global.fetch as Mock).mockRejectedValueOnce(new Error("ECONNREFUSED"));
            (prisma.user.findMany as Mock).mockResolvedValue([{ id: "admin-1" }]);
        });

        it("scores the strongest Jev friction judgment and alerts above 80", async () => {
            mockJudgeFriction.mockResolvedValueOnce({ hostile: 0.2, rejecting: 0.93, spam: 0.1 });

            await new IntentScoringService().processWebhookData({ content: "No. Never contact us again." });

            expect(mockJudgeFriction).toHaveBeenCalledWith("No. Never contact us again.");
            expect(NotificationDispatcher.send).toHaveBeenCalledWith(
                "admin-1", "SYSTEM", "High Friction Detected", "High Karmic Friction Detected (Score: 93.0)", expect.objectContaining({ score: 93 })
            );
        });

        it("does not alert when no Jev judgment passes 0.8", async () => {
            mockJudgeFriction.mockResolvedValueOnce({ hostile: 0.5, rejecting: 0.6, spam: 0.1 });

            await new IntentScoringService().processWebhookData({ content: "Maybe next quarter." });

            expect(NotificationDispatcher.send).not.toHaveBeenCalled();
        });

        it("falls back to the sentiment heuristic when Jev fails", async () => {
            mockJudgeFriction.mockRejectedValueOnce(new Error("JEV_API_KEY is not set"));

            await new IntentScoringService().processWebhookData({ content: "awful", sentiment: { score: -0.9 } });

            expect(NotificationDispatcher.send).toHaveBeenCalledWith(
                "admin-1", "SYSTEM", "High Friction Detected", "High Karmic Friction Detected (Score: 90.0)", expect.objectContaining({ score: 90 })
            );
        });
    });
});
