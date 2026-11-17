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

    it("refuses a report whose message is not text instead of failing with a 500", async () => {
        mockGetCurrentContext.mockResolvedValue({ userId: null, teamId: null });

        const res = await POST(report({ message: { not: "text" } }));

        expect(res.status).toBe(400);
        expect(mockPrisma.clientError.create).not.toHaveBeenCalled();
    });

    it("caps the url, user agent and stack fields a browser can claim", async () => {
        mockGetCurrentContext.mockResolvedValue({ userId: null, teamId: null });

        await POST(report({ url: "https://x.example/" + "a".repeat(5000), userAgent: "b".repeat(5000), stack: 12345 }));

        const data = mockPrisma.clientError.create.mock.calls[0]![0].data;
        expect(data.url).toHaveLength(500);
        expect(data.userAgent).toHaveLength(500);
        expect(data.stack).toBeNull();
    });

    it("stores no metadata that is large or is not an object", async () => {
        mockGetCurrentContext.mockResolvedValue({ userId: null, teamId: null });

        await POST(report({ metadata: { blob: "c".repeat(20_000) } }));
        await POST(report({ metadata: "just a string" }));
        await POST(report({ metadata: { route: "/inbox" } }));

        const stored = mockPrisma.clientError.create.mock.calls.map(([arg]: any) => arg.data.metadata);
        expect(stored).toEqual([{}, {}, { route: "/inbox" }]);
    });

    it("runs the alert query at most once a minute, however many reports arrive", async () => {
        mockGetCurrentContext.mockResolvedValue({ userId: null, teamId: null });
        vi.useFakeTimers();
        try {
            vi.setSystemTime(Date.now() + 60 * 60 * 1000);
            await POST(report({}));
            await POST(report({}));
            await POST(report({}));
            expect(mockMonitor).toHaveBeenCalledTimes(1);

            vi.setSystemTime(Date.now() + 61 * 1000);
            await POST(report({}));
            expect(mockMonitor).toHaveBeenCalledTimes(2);
        } finally {
            vi.useRealTimers();
        }
    });
});
