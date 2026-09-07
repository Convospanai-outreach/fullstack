import { beforeEach, describe, expect, it, vi } from "vitest";

const { mockGetCurrentContext, mockPrisma, mockVerificationAgent } = vi.hoisted(() => ({
    mockGetCurrentContext: vi.fn(),
    mockPrisma: {
        lead: { findUnique: vi.fn(), findMany: vi.fn() },
    },
    mockVerificationAgent: {
        updateConfig: vi.fn(),
        verify: vi.fn(),
        verifyBatch: vi.fn(),
    },
}));

vi.mock("@/lib/auth", () => ({ getCurrentContext: mockGetCurrentContext }));
vi.mock("@/lib/db", () => ({ prisma: mockPrisma }));
vi.mock("@/modules/scoring", () => ({ verificationAgent: mockVerificationAgent }));

import { POST } from "./route";

function postRequest(body: unknown) {
    return new Request("http://localhost/scoring/verify", {
        method: "POST",
        body: JSON.stringify(body),
    }) as any;
}

describe("POST /scoring/verify - does not allow config mutation of the shared singleton (OPEN-219)", () => {
    beforeEach(() => {
        vi.clearAllMocks();
        mockGetCurrentContext.mockResolvedValue({ userId: "user-1", teamId: "team-1" });
        mockPrisma.lead.findUnique.mockResolvedValue({ teamId: "team-1" });
        mockVerificationAgent.verify.mockResolvedValue({ passed: true, score: 0.9 });
    });

    it("ignores an attacker-supplied config and never mutates the process-wide singleton", async () => {
        const res = await POST(postRequest({ leadId: "lead-1", config: { threshold: 999 } }));

        expect(res.status).toBe(200);
        expect(mockVerificationAgent.updateConfig).not.toHaveBeenCalled();
        expect(mockVerificationAgent.verify).toHaveBeenCalledWith("lead-1");
    });

    it("still verifies a lead belonging to the caller's own team", async () => {
        const res = await POST(postRequest({ leadId: "lead-1" }));

        expect(res.status).toBe(200);
        expect(mockVerificationAgent.verify).toHaveBeenCalledWith("lead-1");
    });
});
