import { beforeEach, describe, expect, it, vi } from "vitest";

const { mockGetActor, mockAudit } = vi.hoisted(() => ({ mockGetActor: vi.fn(), mockAudit: vi.fn() }));

vi.mock("@/lib/superadmin/actor", () => ({ getSuperAdminActor: mockGetActor, auditSuperAdmin: mockAudit }));

import { POST } from "./route";

function logout() {
    return POST(new Request("http://localhost/api/superadmin/logout", { method: "POST" }));
}

describe("POST /api/superadmin/logout", () => {
    beforeEach(() => {
        vi.clearAllMocks();
        mockGetActor.mockResolvedValue({ id: "admin-1", email: "a@example.com", enterpriseRole: "SUPER_ADMIN" });
        mockAudit.mockResolvedValue(undefined);
    });

    it("records the logout of the signed-in superadmin and clears the cookie", async () => {
        const res = await logout();

        expect(res.status).toBe(200);
        expect(mockAudit).toHaveBeenCalledWith(expect.objectContaining({ id: "admin-1" }), "LOGOUT", expect.any(Request), {});
        expect(res.headers.get("set-cookie")).toContain("Max-Age=0");
    });

    it("still clears the cookie when the audit row cannot be written", async () => {
        mockAudit.mockRejectedValue(new Error("audit table unavailable"));

        const res = await logout();

        expect(res.status).toBe(200);
        expect(res.headers.get("set-cookie")).toContain("Max-Age=0");
    });

    it("records nothing, and still clears the cookie, when nobody is signed in", async () => {
        mockGetActor.mockResolvedValue(null);

        const res = await logout();

        expect(res.status).toBe(200);
        expect(mockAudit).not.toHaveBeenCalled();
        expect(res.headers.get("set-cookie")).toContain("Max-Age=0");
    });
});
