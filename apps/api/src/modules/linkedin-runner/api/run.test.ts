import { beforeEach, describe, expect, it, vi } from "vitest";

const { mockPrisma, mockGetCurrentContext, mockEnqueue } = vi.hoisted(() => ({
    mockPrisma: {
        lead: { findFirst: vi.fn() },
    },
    mockGetCurrentContext: vi.fn(),
    mockEnqueue: vi.fn(),
}));

vi.mock("@/lib/db", () => ({ prisma: mockPrisma }));
vi.mock("@/lib/auth", () => ({ getCurrentContext: mockGetCurrentContext }));
vi.mock("@/lib/queue", () => ({ JobQueue: { enqueue: mockEnqueue } }));

import { POST } from "./run";

function postRequest(body: unknown) {
    return new Request("http://localhost/linkedin-runner/run", {
        method: "POST",
        body: JSON.stringify(body),
    }) as any;
}

describe("POST /linkedin-runner/run", () => {
    beforeEach(() => {
        vi.clearAllMocks();
        mockEnqueue.mockResolvedValue({ id: "job-1" });
    });

    it("rejects an unauthenticated caller before enqueueing anything", async () => {
        mockGetCurrentContext.mockResolvedValue({ userId: null, teamId: null });

        const res = await POST(postRequest({ profileUrl: "https://linkedin.com/in/x", action: "connect" }));

        expect(res.status).toBe(401);
        expect(mockEnqueue).not.toHaveBeenCalled();
    });

    it("refuses to trigger an action against another team's lead", async () => {
        mockGetCurrentContext.mockResolvedValue({ userId: "user-1", teamId: "team-a" });
        mockPrisma.lead.findFirst.mockResolvedValue(null); // not found for team-a

        const res = await POST(
            postRequest({ profileUrl: "https://linkedin.com/in/x", action: "connect", leadId: "lead-from-team-b" })
        );

        expect(res.status).toBe(404);
        expect(mockPrisma.lead.findFirst).toHaveBeenCalledWith({ where: { id: "lead-from-team-b", teamId: "team-a" } });
        expect(mockEnqueue).not.toHaveBeenCalled();
    });

    it("enqueues with the caller's teamId for a lead that belongs to their team", async () => {
        mockGetCurrentContext.mockResolvedValue({ userId: "user-1", teamId: "team-a" });
        mockPrisma.lead.findFirst.mockResolvedValue({ id: "lead-1", teamId: "team-a" });

        const res = await POST(
            postRequest({ profileUrl: "https://linkedin.com/in/x", action: "connect", leadId: "lead-1" })
        );

        expect(res.status).toBe(200);
        expect(mockEnqueue).toHaveBeenCalledWith("linkedin_scraping", {
            profileUrl: "https://linkedin.com/in/x",
            action: "connect",
            leadId: "lead-1",
            teamId: "team-a",
        });
    });

    it("allows a bare profile scrape with no leadId", async () => {
        mockGetCurrentContext.mockResolvedValue({ userId: "user-1", teamId: "team-a" });

        const res = await POST(postRequest({ profileUrl: "https://linkedin.com/in/x", action: "scrape" }));

        expect(res.status).toBe(200);
        expect(mockPrisma.lead.findFirst).not.toHaveBeenCalled();
        expect(mockEnqueue).toHaveBeenCalledWith("linkedin_scraping", {
            profileUrl: "https://linkedin.com/in/x",
            action: "scrape",
            leadId: undefined,
            teamId: "team-a",
        });
    });
});
