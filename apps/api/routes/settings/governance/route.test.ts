import { beforeEach, describe, expect, it, vi } from "vitest";

const { mockGetCurrentContext, mockPrisma, mockAudit } = vi.hoisted(() => ({
    mockGetCurrentContext: vi.fn(),
    mockPrisma: { organizationPolicy: { update: vi.fn() } },
    mockAudit: vi.fn(),
}));

vi.mock("@/lib/auth", () => ({ getCurrentContext: mockGetCurrentContext }));
vi.mock("@/lib/db", () => ({ prisma: mockPrisma }));
vi.mock("@/lib/governance/audit", () => ({ audit: mockAudit }));
vi.mock("@/lib/permissions", () => ({
    Permission: { MANAGE_POLICY: "manage_policy" },
    authorizePermission: vi.fn().mockResolvedValue(undefined),
}));

import { PUT } from "./route";

describe("PUT /settings/governance", () => {
    beforeEach(() => {
        vi.clearAllMocks();
        mockGetCurrentContext.mockResolvedValue({ userId: "user-1", teamId: "team-a" });
        mockPrisma.organizationPolicy.update.mockResolvedValue({ id: "policy-1" });
    });

    it("records only the policy fields that were applied, not the raw request body", async () => {
        await PUT(
            new Request("http://localhost/settings/governance", {
                method: "PUT",
                body: JSON.stringify({ allowUploads: false, maxAgents: 3, apiKey: "sk-secret", note: { nested: "x".repeat(1000) } }),
            }),
        );

        expect(mockAudit).toHaveBeenCalledTimes(1);
        expect(mockAudit.mock.calls[0]![0].metadata).toEqual({ allowUploads: false, maxAgents: 3 });
    });
});
