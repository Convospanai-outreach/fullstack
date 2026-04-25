import { beforeEach, describe, expect, it, vi, type Mock } from "vitest";

const mockValidateExtensionAuth = vi.fn();
const mockFindMany = vi.fn();
const mockFindFirst = vi.fn();
const mockUpdateMany = vi.fn();
const mockCreateLog = vi.fn();

vi.mock("../../extension/_lib/auth", () => ({
    validateExtensionAuth: mockValidateExtensionAuth
}));

vi.mock("@/lib/db", () => ({
    prisma: {
        agentTask: {
            findMany: mockFindMany,
            findFirst: mockFindFirst,
            updateMany: mockUpdateMany
        },
        agentLog: {
            create: mockCreateLog
        }
    }
}));

describe("legacy queue routes", () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it("rejects unauthenticated access to pending commands", async () => {
        mockValidateExtensionAuth.mockResolvedValue({
            ok: false,
            status: 401,
            code: "INVALID_EXTENSION_KEY",
            error: "Invalid extension key"
        });

        const { GET } = await import("../pending/route");
        const response = await GET(new Request("http://localhost/api/queue/pending") as any);
        const payload = await response.json();

        expect(response.status).toBe(401);
        expect(payload).toEqual({
            ok: false,
            error: "Invalid extension key",
            code: "INVALID_EXTENSION_KEY"
        });
        expect(mockFindMany).not.toHaveBeenCalled();
    });

    it("only fetches pending commands from the caller's teams", async () => {
        mockValidateExtensionAuth.mockResolvedValue({
            ok: true,
            user: { id: "user-1", email: "u@example.com", name: "User", memberships: [{ teamId: "team-a" }] },
            teamIds: ["team-a"]
        });
        mockFindMany.mockResolvedValue([
            {
                id: "task-1",
                teamId: "team-a",
                status: "EXECUTING",
                updatedAt: new Date("2026-01-01T00:00:00.000Z"),
                context: {
                    mode: "BROWSER",
                    actionType: "CONNECT",
                    targetUrl: "https://linkedin.com/in/test",
                    draft: "hello"
                }
            }
        ]);
        mockUpdateMany.mockResolvedValue({ count: 1 });

        const { GET } = await import("../pending/route");
        const response = await GET(new Request("http://localhost/api/queue/pending") as any);
        const payload = await response.json();

        expect(response.status).toBe(200);
        expect(payload.command.id).toBe("task-1");
        expect(payload.command.claimToken).toEqual(expect.any(String));
        expect((mockFindMany as Mock).mock.calls[0]?.[0]).toEqual(
            expect.objectContaining({
                where: expect.objectContaining({
                    teamId: { in: ["team-a"] },
                    status: "EXECUTING"
                })
            })
        );
        expect((mockUpdateMany as Mock).mock.calls[0]?.[0]).toEqual(
            expect.objectContaining({
                where: expect.objectContaining({
                    id: "task-1",
                    teamId: { in: ["team-a"] },
                    status: "EXECUTING"
                })
            })
        );
    });

    it("rejects result writes for tasks outside the caller's teams", async () => {
        mockValidateExtensionAuth.mockResolvedValue({
            ok: true,
            user: { id: "user-1", email: "u@example.com", name: "User", memberships: [{ teamId: "team-a" }] },
            teamIds: ["team-a"]
        });
        mockFindFirst.mockResolvedValue(null);

        const { POST } = await import("../result/route");
        const response = await POST(
            new Request("http://localhost/api/queue/result", {
                method: "POST",
                headers: { "content-type": "application/json" },
                body: JSON.stringify({
                    commandId: "task-2",
                    status: "SUCCESS",
                    details: "done",
                    duration: 12
                })
            }) as any
        );
        const payload = await response.json();

        expect(response.status).toBe(404);
        expect(payload).toEqual({ error: "Task not found" });
        expect(mockUpdateMany).not.toHaveBeenCalled();
        expect(mockCreateLog).not.toHaveBeenCalled();
        expect((mockFindFirst as Mock).mock.calls[0]?.[0]).toEqual({
            where: {
                id: "task-2",
                teamId: { in: ["team-a"] }
            }
        });
    });

    it("rejects result writes with a mismatched claim token", async () => {
        mockValidateExtensionAuth.mockResolvedValue({
            ok: true,
            user: { id: "user-1", email: "u@example.com", name: "User", memberships: [{ teamId: "team-a" }] },
            teamIds: ["team-a"]
        });
        mockFindFirst.mockResolvedValue({
            id: "task-3",
            teamId: "team-a",
            status: "EXECUTING",
            updatedAt: new Date("2026-01-01T00:00:00.000Z"),
            context: {
                extensionClaim: {
                    token: "claim-expected"
                }
            }
        });

        const { POST } = await import("../result/route");
        const response = await POST(
            new Request("http://localhost/api/queue/result", {
                method: "POST",
                headers: { "content-type": "application/json" },
                body: JSON.stringify({
                    commandId: "task-3",
                    status: "SUCCESS",
                    details: "done",
                    duration: 10,
                    claimToken: "claim-other"
                })
            }) as any
        );
        const payload = await response.json();

        expect(response.status).toBe(409);
        expect(payload).toEqual({
            error: "Claim token does not match the active browser claim",
            code: "CLAIM_MISMATCH"
        });
        expect(mockUpdateMany).not.toHaveBeenCalled();
    });
});
