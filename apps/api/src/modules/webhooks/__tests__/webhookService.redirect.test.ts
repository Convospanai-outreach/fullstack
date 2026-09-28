import http from "node:http";
import type { AddressInfo } from "node:net";
import { afterEach, beforeEach, describe, expect, it, vi, type Mock } from "vitest";
import { lookup } from "node:dns/promises";
import { webhookService } from "../service/webhookService";
import { prisma } from "@/lib/db";
import { NonRetryableJobError } from "@/lib/queue";

// Roadmap 3.5 / S-15. Uses the real fetch against local servers (the sibling
// failure test stubs global.fetch, which can't show whether a redirect is followed).
vi.mock("@/lib/db", () => ({
    prisma: {
        webhook: { findUnique: vi.fn(), findFirst: vi.fn() },
        webhookLog: { create: vi.fn() },
    },
}));

// The SSRF guard resolves the webhook host; report a public address so the first
// hop (a loopback test server) gets past it, as a real attacker-owned host would.
vi.mock("node:dns/promises", () => ({ lookup: vi.fn() }));

function listen(handler: http.RequestListener): Promise<{ server: http.Server; port: number }> {
    return new Promise((resolve) => {
        const server = http.createServer(handler);
        server.listen(0, "127.0.0.1", () => resolve({ server, port: (server.address() as AddressInfo).port }));
    });
}

describe("WebhookService redirect handling", () => {
    const servers: http.Server[] = [];

    beforeEach(() => {
        vi.clearAllMocks();
        (lookup as Mock).mockResolvedValue([{ address: "93.184.216.34", family: 4 }]);
    });

    afterEach(async () => {
        await Promise.all(servers.splice(0).map((s) => new Promise((r) => s.close(r))));
    });

    function useWebhookUrl(url: string) {
        (prisma.webhook.findUnique as Mock).mockResolvedValue({ id: "wh_1", url, isActive: true, secret: null });
    }

    it("does not follow a 302 to an internal target, and records the delivery as failed", async () => {
        let internalHits = 0;
        const internal = await listen((_req, res) => {
            internalHits++;
            res.end("instance-metadata-secret");
        });
        const attacker = await listen((_req, res) => {
            res.writeHead(302, { Location: `http://127.0.0.1:${internal.port}/latest/meta-data/` });
            res.end();
        });
        servers.push(internal.server, attacker.server);
        useWebhookUrl(`http://127.0.0.1:${attacker.port}/hook`);

        const delivery = webhookService.processDelivery("wh_1", "lead.created", { id: "l1" });
        await expect(delivery).rejects.toThrow("Target returned redirect 302; redirects are not followed");
        // The job is dead-lettered instead of retried: the target would only redirect again.
        await expect(delivery).rejects.toBeInstanceOf(NonRetryableJobError);

        expect(internalHits).toBe(0);
        expect(prisma.webhookLog.create).toHaveBeenCalledWith({
            data: expect.objectContaining({ status: 302, error: "Target returned redirect 302; redirects are not followed" }),
        });
    });

    it("does not follow a 302 to the cloud metadata address 169.254.169.254", async () => {
        const attacker = await listen((_req, res) => {
            res.writeHead(302, { Location: "http://169.254.169.254/latest/meta-data/iam/security-credentials/" });
            res.end();
        });
        servers.push(attacker.server);
        useWebhookUrl(`http://127.0.0.1:${attacker.port}/hook`);

        await expect(webhookService.processDelivery("wh_1", "lead.created", { id: "l1" }))
            .rejects.toThrow("Target returned redirect 302; redirects are not followed");
    });

    it("still delivers to a target that answers 200 directly", async () => {
        const target = await listen((_req, res) => res.end("ok"));
        servers.push(target.server);
        useWebhookUrl(`http://127.0.0.1:${target.port}/hook`);

        await expect(webhookService.processDelivery("wh_1", "lead.created", { id: "l1" })).resolves.toBeUndefined();
    });
});
