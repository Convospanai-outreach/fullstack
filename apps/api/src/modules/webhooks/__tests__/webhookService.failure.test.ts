import { vi, Mock } from 'vitest';
import { lookup } from "node:dns/promises";
import { webhookService, assertSafeWebhookUrl } from "../service/webhookService";
import { prisma } from "@/lib/db";

// Mock prisma and fetch
vi.mock("@/lib/db", () => ({
    prisma: {
        webhook: {
            findUnique: vi.fn(),
            findFirst: vi.fn(),
        },
        webhookLog: {
            create: vi.fn(),
        },
    },
}));

// Keep the SSRF guard's DNS resolution hermetic in tests.
vi.mock("node:dns/promises", () => ({
    lookup: vi.fn(),
}));

global.fetch = vi.fn() as Mock;

describe("WebhookService Failure scenarios", () => {
    const webhookId = "wh_123";
    const event = "lead.created";
    const payload = { id: "lead_1", email: "test@example.com" };

    beforeEach(() => {
        vi.clearAllMocks();
        (lookup as Mock).mockResolvedValue([{ address: "93.184.216.34", family: 4 }]);
    });

    test("should log failure and throw when target returns 500", async () => {
        (prisma.webhook.findUnique as Mock).mockResolvedValue({
            id: webhookId,
            url: "https://example.com/webhook",
            isActive: true,
            secret: "shhh",
        });

        (global.fetch as Mock).mockResolvedValue({
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
        (prisma.webhook.findUnique as Mock).mockResolvedValue({
            id: webhookId,
            url: "https://example.com/webhook",
            isActive: true,
        });

        (global.fetch as Mock).mockRejectedValue(new Error("DNS Resolution Failed"));

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
        (prisma.webhook.findUnique as Mock).mockResolvedValue({
            id: webhookId,
            isActive: false,
        });

        await webhookService.processDelivery(webhookId, event, payload);

        expect(global.fetch).not.toHaveBeenCalled();
        expect(prisma.webhookLog.create).not.toHaveBeenCalled();
    });

    test("should not dispatch to a URL that resolves to a private address", async () => {
        (prisma.webhook.findUnique as Mock).mockResolvedValue({
            id: webhookId,
            url: "https://internal.example.com/webhook",
            isActive: true,
        });
        (lookup as Mock).mockResolvedValue([{ address: "169.254.169.254", family: 4 }]);

        await expect(webhookService.processDelivery(webhookId, event, payload))
            .rejects.toThrow("Webhook URL resolves to a non-public address");

        expect(global.fetch).not.toHaveBeenCalled();
    });

    test("should abort delivery once the timeout elapses", async () => {
        (prisma.webhook.findUnique as Mock).mockResolvedValue({
            id: webhookId,
            url: "https://example.com/webhook",
            isActive: true,
        });

        let passedSignal: AbortSignal | undefined;
        (global.fetch as Mock).mockImplementation((_url: string, init: RequestInit) => {
            passedSignal = init.signal as AbortSignal;
            return Promise.reject(new Error("aborted"));
        });

        await expect(webhookService.processDelivery(webhookId, event, payload))
            .rejects.toThrow("aborted");

        expect(passedSignal).toBeInstanceOf(AbortSignal);
    });
});

describe("WebhookService.processDelivery teamId scoping (OPEN-162)", () => {
    const webhookId = "wh_123";
    const event = "lead.created";
    const payload = { id: "lead_1" };

    beforeEach(() => {
        vi.clearAllMocks();
        (lookup as Mock).mockResolvedValue([{ address: "93.184.216.34", family: 4 }]);
    });

    test("skips delivery when a teamId is supplied and the webhook doesn't belong to it", async () => {
        (prisma.webhook.findFirst as Mock).mockResolvedValue(null);

        await webhookService.processDelivery(webhookId, event, payload, "team-a");

        expect(prisma.webhook.findFirst).toHaveBeenCalledWith({
            where: { id: webhookId, teamId: "team-a" },
        });
        expect(prisma.webhook.findUnique).not.toHaveBeenCalled();
        expect(global.fetch).not.toHaveBeenCalled();
    });

    test("delivers when the webhook belongs to the supplied teamId", async () => {
        (prisma.webhook.findFirst as Mock).mockResolvedValue({
            id: webhookId,
            url: "https://example.com/webhook",
            isActive: true,
            teamId: "team-a",
        });
        (global.fetch as Mock).mockResolvedValue({
            ok: true,
            status: 200,
            text: () => Promise.resolve("ok"),
        });

        await webhookService.processDelivery(webhookId, event, payload, "team-a");

        expect(global.fetch).toHaveBeenCalled();
    });

    test("falls back to an unscoped lookup when no teamId is supplied", async () => {
        (prisma.webhook.findUnique as Mock).mockResolvedValue({
            id: webhookId,
            isActive: false,
        });

        await webhookService.processDelivery(webhookId, event, payload);

        expect(prisma.webhook.findUnique).toHaveBeenCalledWith({ where: { id: webhookId } });
        expect(prisma.webhook.findFirst).not.toHaveBeenCalled();
    });
});

describe("assertSafeWebhookUrl", () => {
    beforeEach(() => {
        vi.clearAllMocks();
        (lookup as Mock).mockResolvedValue([{ address: "93.184.216.34", family: 4 }]);
    });

    test("allows a public https URL", async () => {
        await expect(assertSafeWebhookUrl("https://example.com/hook")).resolves.toBeUndefined();
    });

    test.each([
        ["loopback", "127.0.0.1", 4],
        ["private class A", "10.1.2.3", 4],
        ["private class C", "192.168.1.10", 4],
        ["link-local metadata", "169.254.169.254", 4],
        ["IPv6 loopback", "::1", 6],
        ["IPv6 unique-local", "fd00::1", 6],
    ])("rejects %s", async (_label, address, family) => {
        (lookup as Mock).mockResolvedValue([{ address, family }]);
        await expect(assertSafeWebhookUrl("https://anything.example/hook"))
            .rejects.toThrow("non-public address");
    });

    test("rejects non-http protocols", async () => {
        await expect(assertSafeWebhookUrl("file:///etc/passwd"))
            .rejects.toThrow("is not allowed");
    });

    test("rejects a malformed URL", async () => {
        await expect(assertSafeWebhookUrl("not-a-url"))
            .rejects.toThrow("not a valid URL");
    });
});
