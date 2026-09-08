import path from "path";
import { beforeEach, describe, expect, it, vi } from "vitest";

const { mockFindOrCreateClerkAppUser, mockExecFileSync } = vi.hoisted(() => ({
    mockFindOrCreateClerkAppUser: vi.fn(),
    mockExecFileSync: vi.fn(),
}));

vi.mock("next-auth", () => ({ getServerSession: vi.fn().mockResolvedValue(null) }));
vi.mock("@/lib/auth", () => ({
    authOptions: {},
    isSuperAdminRole: (role: unknown) => role === "SUPER_ADMIN" || role === "SYSTEM_ADMIN",
}));
vi.mock("@/lib/clerkAuth", () => ({ findOrCreateClerkAppUser: mockFindOrCreateClerkAppUser }));
vi.mock("child_process", () => ({ execFileSync: mockExecFileSync }));

function putRequest(body: unknown) {
    return new Request("http://localhost/api/admin/cms", {
        method: "PUT",
        body: JSON.stringify(body),
    }) as any;
}

describe("PUT /api/admin/cms - git sync never goes through a shell", () => {
    beforeEach(() => {
        vi.clearAllMocks();
        mockFindOrCreateClerkAppUser.mockResolvedValue({ enterpriseRole: "SUPER_ADMIN" });
    });

    it("passes git arguments as an argv array, never a shell command string built by interpolation", async () => {
        const { PUT } = await import("./route");

        await PUT(putRequest({ file: "x.md" }));

        for (const [cmd, args] of mockExecFileSync.mock.calls) {
            expect(cmd).toBe("git");
            expect(Array.isArray(args)).toBe(true);
        }
        expect(mockExecFileSync).toHaveBeenCalledWith("git", ["add", path.join("content", "x.md")], expect.anything());
        expect(mockExecFileSync).toHaveBeenCalledWith(
            "git",
            ["commit", "-m", "cms: auto-update content file: x.md"],
            expect.anything()
        );
        expect(mockExecFileSync).toHaveBeenCalledWith("git", ["push", "origin", "HEAD"], expect.anything());
    });

    it("rejects a path that escapes the content directory before any git command runs", async () => {
        const { PUT } = await import("./route");

        const response = await PUT(putRequest({ file: "../../etc/passwd" }));

        expect(response.status).toBe(500);
        expect(mockExecFileSync).not.toHaveBeenCalled();
    });

    it("rejects a caller without CMS access", async () => {
        mockFindOrCreateClerkAppUser.mockResolvedValue({ enterpriseRole: "SALES_USER" });
        const { PUT } = await import("./route");

        const response = await PUT(putRequest({ file: "safe.md" }));

        expect(response.status).toBe(401);
        expect(mockExecFileSync).not.toHaveBeenCalled();
    });

    it("OPEN-205: rejects a self-service ORG_ADMIN/CMS_EDITOR - this route touches a platform-wide content dir and pushes to the app's own repo, not per-tenant data", async () => {
        const { PUT } = await import("./route");

        mockFindOrCreateClerkAppUser.mockResolvedValue({ enterpriseRole: "ORG_ADMIN" });
        const orgAdminResponse = await PUT(putRequest({ file: "safe.md" }));
        expect(orgAdminResponse.status).toBe(401);

        mockFindOrCreateClerkAppUser.mockResolvedValue({ enterpriseRole: "CMS_EDITOR" });
        const cmsEditorResponse = await PUT(putRequest({ file: "safe.md" }));
        expect(cmsEditorResponse.status).toBe(401);

        expect(mockExecFileSync).not.toHaveBeenCalled();
    });
});
