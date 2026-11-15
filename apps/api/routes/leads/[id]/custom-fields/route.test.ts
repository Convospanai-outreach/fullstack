import { beforeEach, describe, expect, it, vi } from "vitest";

const { mockGetCurrentContext, mockAuthorizeRole, mockUpdate } = vi.hoisted(() => ({
    mockGetCurrentContext: vi.fn(),
    mockAuthorizeRole: vi.fn(),
    mockUpdate: vi.fn(),
}));

vi.mock("@/lib/auth", () => ({ getCurrentContext: mockGetCurrentContext }));
vi.mock("@/lib/permissions", () => ({ authorizeRole: mockAuthorizeRole, TeamRole: { MEMBER: "MEMBER" } }));
vi.mock("@/modules/lead-properties/leadPropertyService", () => ({ updateLeadCustomFields: mockUpdate }));

import { PATCH } from "./route";

describe("PATCH /leads/[id]/custom-fields", () => {
    beforeEach(() => {
        vi.clearAllMocks();
        mockGetCurrentContext.mockResolvedValue({ teamId: "team-1", userId: "user-1" });
        mockAuthorizeRole.mockResolvedValue(undefined);
    });

    it("lets a team member save values for a lead in their team", async () => {
        mockUpdate.mockResolvedValue({ budget: 300 });

        const res = await PATCH(new Request("http://localhost/x", { method: "PATCH", body: JSON.stringify({ budget: "300", notes: null }) }), {
            params: Promise.resolve({ id: "lead-1" }),
        });

        expect(mockAuthorizeRole).toHaveBeenCalledWith("user-1", "team-1", "MEMBER");
        expect(mockUpdate).toHaveBeenCalledWith("team-1", "user-1", "lead-1", { budget: "300", notes: null });
        expect(await res.json()).toEqual({ customFields: { budget: 300 } });
    });

    it("rejects a body that is not a JSON object", async () => {
        const res = await PATCH(new Request("http://localhost/x", { method: "PATCH", body: JSON.stringify(["budget"]) }), {
            params: Promise.resolve({ id: "lead-1" }),
        });

        expect(res.status).toBe(400);
        expect(mockUpdate).not.toHaveBeenCalled();
    });
});
