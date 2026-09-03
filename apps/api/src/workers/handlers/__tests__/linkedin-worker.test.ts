import { beforeEach, describe, expect, it, vi } from "vitest";

const { mockPrisma, mockRunAutomation } = vi.hoisted(() => ({
    mockPrisma: {
        activity: { create: vi.fn() },
        lead: { updateMany: vi.fn() },
    },
    mockRunAutomation: vi.fn(),
}));

vi.mock("@/lib/db", () => ({ prisma: mockPrisma }));
vi.mock("@/modules/linkedin-runner/service/linkedinRunnerService", () => ({
    linkedinRunnerService: { runAutomation: mockRunAutomation },
}));

import { handleLinkedInScrape } from "../linkedin-worker";

describe("handleLinkedInScrape", () => {
    beforeEach(() => {
        vi.clearAllMocks();
        mockRunAutomation.mockResolvedValue({ result: "ok" });
        mockPrisma.activity.create.mockResolvedValue({});
        mockPrisma.lead.updateMany.mockResolvedValue({ count: 1 });
    });

    it("scopes the connection-sent write by teamId, not just leadId", async () => {
        await handleLinkedInScrape({
            profileUrl: "https://linkedin.com/in/x",
            action: "connect",
            leadId: "lead-1",
            teamId: "team-1",
        });

        expect(mockPrisma.lead.updateMany).toHaveBeenCalledWith({
            where: { id: "lead-1", teamId: "team-1" },
            data: { status: "connection_sent" },
        });
    });

    it("skips the lead write entirely when no teamId is present, instead of updating unscoped", async () => {
        await handleLinkedInScrape({
            profileUrl: "https://linkedin.com/in/x",
            action: "connect",
            leadId: "lead-1",
        });

        expect(mockPrisma.lead.updateMany).not.toHaveBeenCalled();
    });
});
