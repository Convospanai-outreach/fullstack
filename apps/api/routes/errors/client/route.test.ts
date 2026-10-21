import { beforeEach, describe, expect, it, vi } from "vitest";

const { mockPrisma, mockGetCurrentContext, mockMonitor } = vi.hoisted(() => ({
    mockPrisma: { clientError: { create: vi.fn() } },
    mockGetCurrentContext: vi.fn(),
    mockMonitor: vi.fn(),
}));

vi.mock("@/lib/db", () => ({ prisma: mockPrisma }));
vi.mock("@/lib/auth", () => ({ getCurrentContext: mockGetCurrentContext }));
vi.mock("@/lib/errors/ClientErrorAlertService", () => ({ ClientErrorAlertService: { monitorAndAlert: mockMonitor } }));
vi.mock("@/lib/logger", () => ({ logger: { info: vi.fn(), error: vi.fn(), warn: vi.fn() } }));

import { POST } from "./route";

let nextIp = 0;
function report(body: Record<string, unknown>) {
    // Each test gets its own address so the in-memory rate limit never leaks between tests.
    nextIp += 1;
    return new Request("http://localhost/errors/client", {
        method: "POST",
        headers: { "x-forwarded-for": `198.51.100.${nextIp}` },
        body: JSON.stringify({ message: "boom", ...body }),
    }) as any;
}

describe("POST /errors/client", () => {
    beforeEach(() => {
        vi.clearAllMocks();
        mockPrisma.clientError.create.mockResolvedValue({ id: "err-1" });
        mockMonitor.mockResolvedValue(undefined);
    });

    it("attributes the error to the signed-in user, not to a userId the browser claims", async () => {
        mockGetCurrentContext.mockResolvedValue({ userId: "user-real", teamId: "team-1" });

        const res = await POST(report({ userId: "user-someone-else" }));

        expect(res.status).toBe(200);
        expect(mockPrisma.clientError.create).toHaveBeenCalledWith({
            data: expect.objectContaining({ userId: "user-real" }),
        });
    });

    it("stores no user for an anonymous report, even if the body names one", async () => {
        mockGetCurrentContext.mockResolvedValue({ userId: null, teamId: null });

        const res = await POST(report({ userId: "user-someone-else" }));

        expect(res.status).toBe(200);
        expect(mockPrisma.clientError.create).toHaveBeenCalledWith({
            data: expect.objectContaining({ userId: null }),
        });
    });

    it("still accepts the report when the session lookup fails", async () => {
        mockGetCurrentContext.mockRejectedValue(new Error("no session"));

        const res = await POST(report({}));

        expect(res.status).toBe(200);
        expect(mockPrisma.clientError.create).toHaveBeenCalledWith({
            data: expect.objectContaining({ userId: null }),
        });
    });
});
