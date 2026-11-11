import { beforeEach, describe, expect, it, vi } from "vitest";

const { mockGetCurrentContext, mockAuthorizeRole, mockList, mockCreate } = vi.hoisted(() => ({
    mockGetCurrentContext: vi.fn(),
    mockAuthorizeRole: vi.fn(),
    mockList: vi.fn(),
    mockCreate: vi.fn(),
}));

vi.mock("@/lib/auth", () => ({ getCurrentContext: mockGetCurrentContext }));
vi.mock("@/lib/permissions", () => ({ authorizeRole: mockAuthorizeRole, TeamRole: { MEMBER: "MEMBER", ADMIN: "ADMIN" } }));
vi.mock("@/modules/lead-properties/leadPropertyService", () => ({
    listLeadProperties: mockList,
    createLeadProperty: mockCreate,
}));

import { GET, POST } from "./route";

describe("/settings/custom-properties", () => {
    beforeEach(() => {
        vi.clearAllMocks();
        mockGetCurrentContext.mockResolvedValue({ teamId: "team-1", userId: "user-1" });
        mockAuthorizeRole.mockResolvedValue(undefined);
    });

    it("GET lets any team member read the active definitions", async () => {
        mockList.mockResolvedValue([{ id: "prop-1", key: "budget" }]);

        const res = await GET();

        expect(mockAuthorizeRole).toHaveBeenCalledWith("user-1", "team-1", "MEMBER");
        expect(mockList).toHaveBeenCalledWith("team-1");
        expect(await res.json()).toEqual({ properties: [{ id: "prop-1", key: "budget" }] });
    });

    it("POST needs the admin role and creates the definition for the caller's team", async () => {
        mockCreate.mockResolvedValue({ id: "prop-2", key: "plan" });

        const res = await POST(
            new Request("http://localhost/settings/custom-properties", {
                method: "POST",
                body: JSON.stringify({ key: "plan", label: "Plan", type: "choice", options: ["a", "b"] }),
            }),
        );

        expect(mockAuthorizeRole).toHaveBeenCalledWith("user-1", "team-1", "ADMIN");
        expect(mockCreate).toHaveBeenCalledWith("team-1", "user-1", { key: "plan", label: "Plan", type: "choice", options: ["a", "b"] });
        expect(res.status).toBe(201);
    });

    it("POST rejects a body with unexpected shape before calling the service", async () => {
        const res = await POST(new Request("http://localhost/settings/custom-properties", { method: "POST", body: JSON.stringify({ key: 5 }) }));

        expect(res.status).toBe(400);
        expect(mockCreate).not.toHaveBeenCalled();
    });
});
