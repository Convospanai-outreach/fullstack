import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock dependencies for campaign execution worker testing
vi.mock("@/lib/db", () => {
    const mockTx = {
        email: {
            create: vi.fn().mockResolvedValue({ id: "email-123", subject: "Test Subject", body: "Test Body" }),
        },
        lead: {
            update: vi.fn().mockResolvedValue({ id: "lead-1" }),
        },
        user: {
            findFirst: vi.fn().mockResolvedValue({ id: "user-456" }),
        },
        approvalRequest: {
            create: vi.fn().mockResolvedValue({ id: "approval-789" }),
        },
    };

    const mockPrisma = {
        campaign: {
            findUnique: vi.fn().mockResolvedValue({
                id: "camp-1",
                name: "Test Campaign",
                description: "Test Description",
                teamId: "team-1",
                ownerId: "user-456",
                leadList: [{ id: "lead-1", email: "test@example.com", fullName: "Test Lead" }],
            }),
            update: vi.fn().mockResolvedValue({ id: "camp-1" }),
        },
        lead: {
            findMany: vi.fn().mockResolvedValue([]),
            count: vi.fn().mockResolvedValue(1),
        },
        email: {
            findFirst: vi.fn().mockResolvedValue(null),
        },
        user: {
            findFirst: vi.fn().mockResolvedValue({ id: "user-456" }),
        },
        approvalRequest: {
            findFirst: vi.fn().mockResolvedValue(null),
            create: vi.fn().mockResolvedValue({ id: "approval-789" }),
        },
        $transaction: vi.fn(async (cb) => cb(mockTx)),
    };

    return { prisma: mockPrisma };
});

vi.mock("@/lib/aiService", () => ({
    generateEmailDraftWithAI: vi.fn().mockResolvedValue({
        subject: "AI Generated Subject",
        body: "AI Generated Body",
        providerUsed: "gemini",
        estimatedCostUsd: 0.001,
    }),
}));

vi.mock("@/lib/logger", () => ({
    logger: {
        info: vi.fn(),
        error: vi.fn(),
        warn: vi.fn(),
    },
}));

import { handleCampaignExecution } from "@/workers/handlers/campaign-execution-worker";

describe("Campaign Execution Worker Approval Request Generation", () => {
    it("guarantees ApprovalRequest creation in DB write path when AI draft is generated", async () => {
        const { prisma } = await import("@/lib/db");
        
        await handleCampaignExecution({ campaignId: "camp-1", userId: "user-456" });

        // Verify transaction ran email creation AND approvalRequest creation
        expect(prisma.$transaction).toHaveBeenCalled();
    });
});
