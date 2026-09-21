import { beforeEach, describe, expect, it, vi } from "vitest";

// publishCampaign runs the Cloudflare edge push AFTER the DB transaction commits.
// These tests pin the fix for F-16: the returned object must surface the edge-push
// outcome (skipped / error) so the UI can't report an unqualified success when the
// page never actually reached Cloudflare.

const { mockPrisma, publishPageToCloudflare } = vi.hoisted(() => {
    const tx = {
        landingPage: {
            updateMany: vi.fn().mockResolvedValue({ count: 1 }),
            findUniqueOrThrow: vi.fn().mockResolvedValue({ id: "page-1", slug: "my-campaign" }),
        },
        landingCampaign: {
            updateMany: vi.fn().mockResolvedValue({ count: 1 }),
            findUniqueOrThrow: vi.fn().mockResolvedValue({ id: "camp-1" }),
        },
    };
    return {
        publishPageToCloudflare: vi.fn(),
        mockPrisma: {
            landingCampaign: {
                findFirst: vi.fn().mockResolvedValue({
                    id: "camp-1",
                    name: "My Campaign",
                    pages: [{ id: "page-1", slug: "my-campaign" }],
                }),
            },
            landingPage: { findUnique: vi.fn() },
            $transaction: vi.fn(async (cb: (t: typeof tx) => unknown) => cb(tx)),
        },
    };
});

vi.mock("@/lib/db", () => ({ prisma: mockPrisma }));
vi.mock("@/lib/aiService", () => ({ aiService: {} }));
vi.mock("@/modules/learning/EventStore", () => ({ EventStore: {}, SystemEventType: {} }));
vi.mock("@/lib/governance/audit", () => ({ audit: vi.fn() }));
vi.mock("@/lib/governance/guard", () => ({ enforcePolicy: vi.fn() }));
vi.mock("@/lib/outboxService", () => ({ OutboxService: { publishEvent: vi.fn() } }));
vi.mock("@/lib/blindIndexService", () => ({ BlindIndexService: {} }));
vi.mock("@/modules/governance/ApprovalService", () => ({ ApprovalService: {} }));
vi.mock("./service/cloudflarePagesService", () => ({
    cloudflarePagesService: { publishPageToCloudflare },
}));

import { landingAgentService } from "./service";

describe("landingAgentService.publishCampaign - edge-push outcome", () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it("surfaces a skipped edge push instead of reporting unqualified success", async () => {
        publishPageToCloudflare.mockResolvedValue({ status: "skipped", details: "not configured" });

        const result = await landingAgentService.publishCampaign({
            teamId: "team-1",
            userId: "user-1",
            campaignId: "camp-1",
            requireApproval: false,
        });

        expect(result.status).toBe("PUBLISHED");
        expect(result.cloudflare).toEqual({ status: "skipped" });
    });

    it("surfaces an errored edge push (status only, no raw details leaked to the caller)", async () => {
        publishPageToCloudflare.mockResolvedValue({ status: "error", details: "Cloudflare KV write failed: 403 forbidden" });

        const result = await landingAgentService.publishCampaign({
            teamId: "team-1",
            userId: "user-1",
            campaignId: "camp-1",
            requireApproval: false,
        });

        expect(result.cloudflare).toEqual({ status: "error" });
        expect(JSON.stringify(result.cloudflare)).not.toContain("forbidden");
    });

    it("reports a pushed edge push on the happy path", async () => {
        publishPageToCloudflare.mockResolvedValue({ status: "pushed" });

        const result = await landingAgentService.publishCampaign({
            teamId: "team-1",
            userId: "user-1",
            campaignId: "camp-1",
            requireApproval: false,
        });

        expect(result.cloudflare).toEqual({ status: "pushed" });
    });
});
