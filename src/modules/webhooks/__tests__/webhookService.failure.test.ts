import { webhookService } from "../service/webhookService";
import { prisma } from "@/lib/db";

// Mock prisma and fetch
jest.mock("@/lib/db", () => ({
    prisma: {
        webhook: {
            findUnique: jest.fn(),
        },
        webhookLog: {
            create: jest.fn(),
        },
    },
}));

global.fetch = jest.fn() as jest.Mock;

describe("WebhookService Failure scenarios", () => {
    const webhookId = "wh_123";
    const event = "lead.created";
    const payload = { id: "lead_1", email: "test@example.com" };

    beforeEach(() => {
        jest.clearAllMocks();
    });

    test("should log failure and throw when target returns 500", async () => {
        (prisma.webhook.findUnique as jest.Mock).mockResolvedValue({
            id: webhookId,
            url: "https://example.com/webhook",
            isActive: true,
            secret: "shhh",
        });

        (global.fetch as jest.Mock).mockResolvedValue({
            ok: false,
            status: 500,
            text: () => Promise.resolve("Internal Server Error"),
        });

        await expect(webhookService.processDelivery(webhookId, event, payload))
            .rejects.toThrow("Target returned 500");

        expect(prisma.webhookLog.create).toHaveBeenCalledWith({
            data: expect.objectContaining({
                webhookId,
                status: 500,
                error: "Target returned 500",
                response: { content: "Internal Server Error" },
            }),
        });
    });

    test("should log failure and throw when network error occurs", async () => {
        (prisma.webhook.findUnique as jest.Mock).mockResolvedValue({
            id: webhookId,
            url: "https://example.com/webhook",
            isActive: true,
        });

        (global.fetch as jest.Mock).mockRejectedValue(new Error("DNS Resolution Failed"));

        await expect(webhookService.processDelivery(webhookId, event, payload))
            .rejects.toThrow("DNS Resolution Failed");

        expect(prisma.webhookLog.create).toHaveBeenCalledWith({
            data: expect.objectContaining({
                webhookId,
                status: 0,
                error: "DNS Resolution Failed",
            }),
        });
    });

    test("should skip delivery if webhook is inactive", async () => {
        (prisma.webhook.findUnique as jest.Mock).mockResolvedValue({
            id: webhookId,
            isActive: false,
        });

        await webhookService.processDelivery(webhookId, event, payload);

        expect(global.fetch).not.toHaveBeenCalled();
        expect(prisma.webhookLog.create).not.toHaveBeenCalled();
    });
});
