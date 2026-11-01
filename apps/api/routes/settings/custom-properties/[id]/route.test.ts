import { beforeEach, describe, expect, it, vi } from "vitest";

const { mockGetCurrentContext, mockAuthorizeRole, mockRename, mockArchive } = vi.hoisted(() => ({
    mockGetCurrentContext: vi.fn(),
    mockAuthorizeRole: vi.fn(),
    mockRename: vi.fn(),
    mockArchive: vi.fn(),
}));

vi.mock("@/lib/auth", () => ({ getCurrentContext: mockGetCurrentContext }));
vi.mock("@/lib/permissions", () => ({ authorizeRole: mockAuthorizeRole, TeamRole: { ADMIN: "ADMIN" } }));
vi.mock("@/modules/lead-properties/leadPropertyService", () => ({
    renameLeadProperty: mockRename,
    archiveLeadProperty: mockArchive,
}));

import { APIError } from "@/lib/apiResponse";
import { DELETE, PATCH } from "./route";

const params = { params: Promise.resolve({ id: "prop-1" }) };

describe("/settings/custom-properties/[id]", () => {
    beforeEach(() => {
        vi.clearAllMocks();
        mockGetCurrentContext.mockResolvedValue({ teamId: "team-1", userId: "user-1" });
        mockAuthorizeRole.mockResolvedValue(undefined);
    });

    it("PATCH renames the label for an admin, and ignores key and type changes", async () => {
        const res = await PATCH(
            new Request("http://localhost/x", { method: "PATCH", body: JSON.stringify({ label: "Monthly budget", key: "other", type: "text" }) }),
            params,
        );

        expect(mockAuthorizeRole).toHaveBeenCalledWith("user-1", "team-1", "ADMIN");
        expect(mockRename).toHaveBeenCalledWith("team-1", "user-1", "prop-1", "Monthly budget");
        expect(res.status).toBe(200);
    });

    it("DELETE archives (hides) the property for an admin", async () => {
        const res = await DELETE(new Request("http://localhost/x", { method: "DELETE" }), params);

        expect(mockAuthorizeRole).toHaveBeenCalledWith("user-1", "team-1", "ADMIN");
        expect(mockArchive).toHaveBeenCalledWith("team-1", "user-1", "prop-1");
        expect(res.status).toBe(200);
    });

    it("a non-admin is stopped before any change", async () => {
        mockAuthorizeRole.mockRejectedValueOnce(new APIError("Forbidden", 403, "FORBIDDEN"));

        const res = await DELETE(new Request("http://localhost/x", { method: "DELETE" }), params);

        expect(res.status).toBe(403);
        expect(mockArchive).not.toHaveBeenCalled();
    });
});
