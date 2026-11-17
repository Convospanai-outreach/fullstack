import path from "path";
import { beforeEach, describe, expect, it, vi } from "vitest";

const { mockGetServerSession, mockExecFileSync, mockAuditCreate } = vi.hoisted(() => ({
    mockGetServerSession: vi.fn(),
    mockExecFileSync: vi.fn(),
    mockAuditCreate: vi.fn(),
}));

vi.mock("next-auth", () => ({ getServerSession: mockGetServerSession }));
vi.mock("@/lib/auth", () => ({
    authOptions: {},
    isSuperAdminRole: (role: unknown) => role === "SUPER_ADMIN" || role === "SYSTEM_ADMIN",
}));
vi.mock("child_process", () => ({ execFileSync: mockExecFileSync }));
// The write path must never touch the real content directory from a test.
vi.mock("fs", async (importOriginal) => {
    const actual = await importOriginal<typeof import("fs")>();
    const mocked = { ...actual, mkdirSync: vi.fn(), writeFileSync: vi.fn() };
    return { ...mocked, default: mocked };
});
vi.mock("@/lib/db", () => ({ prisma: { superAdminAuditLog: { create: mockAuditCreate } } }));

function sessionWithRole(enterpriseRole: string) {
    return { user: { id: "admin-1", enterpriseRole } };
}

function putRequest(body: unknown) {
    return new Request("http://localhost/api/admin/cms", {
        method: "PUT",
        body: JSON.stringify(body),
    }) as any;
}

describe("PUT /api/admin/cms - git sync never goes through a shell", () => {
    beforeEach(() => {
        vi.clearAllMocks();
        mockGetServerSession.mockResolvedValue(sessionWithRole("SUPER_ADMIN"));
        mockAuditCreate.mockResolvedValue({});
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

    it("rejects a sibling directory that merely shares the content directory's name as a prefix", async () => {
        const { PUT } = await import("./route");

        const response = await PUT(putRequest({ file: "../content-evil/x.md" }));

        expect(response.status).toBe(500);
        expect(mockExecFileSync).not.toHaveBeenCalled();
    });

    it("rejects a caller without CMS access", async () => {
        mockGetServerSession.mockResolvedValue(sessionWithRole("SALES_USER"));
        const { PUT } = await import("./route");

        const response = await PUT(putRequest({ file: "safe.md" }));

        expect(response.status).toBe(401);
        expect(mockExecFileSync).not.toHaveBeenCalled();
    });

    it("OPEN-205: rejects a self-service ORG_ADMIN/CMS_EDITOR - this route touches a platform-wide content dir and pushes to the app's own repo, not per-tenant data", async () => {
        const { PUT } = await import("./route");

        mockGetServerSession.mockResolvedValue(sessionWithRole("ORG_ADMIN"));
        const orgAdminResponse = await PUT(putRequest({ file: "safe.md" }));
        expect(orgAdminResponse.status).toBe(401);

        mockGetServerSession.mockResolvedValue(sessionWithRole("CMS_EDITOR"));
        const cmsEditorResponse = await PUT(putRequest({ file: "safe.md" }));
        expect(cmsEditorResponse.status).toBe(401);

        expect(mockExecFileSync).not.toHaveBeenCalled();
    });
});

function postRequest(body: unknown) {
    return new Request("http://localhost/api/admin/cms", {
        method: "POST",
        headers: { "cf-connecting-ip": "203.0.113.9" },
        body: JSON.stringify(body),
    }) as any;
}

describe("/api/admin/cms - audit trail", () => {
    beforeEach(() => {
        vi.clearAllMocks();
        mockGetServerSession.mockResolvedValue(sessionWithRole("SUPER_ADMIN"));
        mockAuditCreate.mockResolvedValue({});
    });

    it("records a git push, before it runs, with who, which file and from where", async () => {
        const { PUT } = await import("./route");

        const res = await PUT(new Request("http://localhost/api/admin/cms", {
            method: "PUT",
            headers: { "cf-connecting-ip": "203.0.113.9" },
            body: JSON.stringify({ file: "x.md" }),
        }) as any);

        expect(res.status).toBe(200);
        expect(mockAuditCreate).toHaveBeenCalledWith({
            data: { userId: "admin-1", action: "CMS_PUSH", ipAddress: "203.0.113.9", metadata: { file: "x.md" } },
        });
        expect(mockAuditCreate.mock.invocationCallOrder[0]).toBeLessThan(mockExecFileSync.mock.invocationCallOrder[0]!);
    });

    it("does not push when the audit row cannot be written", async () => {
        mockAuditCreate.mockRejectedValue(new Error("audit table unavailable"));
        const { PUT } = await import("./route");

        const res = await PUT(new Request("http://localhost/api/admin/cms", { method: "PUT", body: JSON.stringify({ file: "x.md" }) }) as any);

        expect(res.status).toBe(500);
        expect(mockExecFileSync).not.toHaveBeenCalled();
    });

    it("records a content write with the file name, not the content", async () => {
        const { POST } = await import("./route");

        const res = await POST(postRequest({ file: "tmp-audit-test/page.md", content: "SECRET BODY TEXT" }));

        expect(res.status).toBe(200);
        expect(mockAuditCreate).toHaveBeenCalledWith({
            data: expect.objectContaining({ userId: "admin-1", action: "CMS_WRITE", metadata: { file: "tmp-audit-test/page.md" } }),
        });
        expect(JSON.stringify(mockAuditCreate.mock.calls)).not.toContain("SECRET BODY TEXT");
    });
});

