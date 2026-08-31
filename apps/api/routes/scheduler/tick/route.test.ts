import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const { mockProcessDueSchedules } = vi.hoisted(() => ({
    mockProcessDueSchedules: vi.fn(),
}));

vi.mock("@/modules/scheduler/schedulerService", () => ({
    schedulerService: { processDueSchedules: mockProcessDueSchedules },
}));

function postRequest(authHeader?: string) {
    const headers: Record<string, string> = {};
    if (authHeader !== undefined) headers["authorization"] = authHeader;
    return new Request("http://localhost/api/scheduler/tick", { method: "POST", headers }) as any;
}

describe("POST /api/scheduler/tick - uses a timing-safe comparison for CRON_SECRET", () => {
    const originalSecret = process.env["CRON_SECRET"];

    beforeEach(() => {
        vi.clearAllMocks();
        process.env["CRON_SECRET"] = "super-secret-cron-token";
    });

    afterEach(() => {
        process.env["CRON_SECRET"] = originalSecret;
    });

    it("rejects a missing authorization header", async () => {
        const { POST } = await import("./route");
        const response = await POST(postRequest());
        expect(response.status).toBe(401);
        expect(mockProcessDueSchedules).not.toHaveBeenCalled();
    });

    it("rejects a wrong secret", async () => {
        const { POST } = await import("./route");
        const response = await POST(postRequest("Bearer wrong-secret"));
        expect(response.status).toBe(401);
        expect(mockProcessDueSchedules).not.toHaveBeenCalled();
    });

    it("rejects a secret of a different length without throwing", async () => {
        const { POST } = await import("./route");
        const response = await POST(postRequest("Bearer short"));
        expect(response.status).toBe(401);
    });

    it("accepts the correct secret", async () => {
        mockProcessDueSchedules.mockResolvedValue([]);
        const { POST } = await import("./route");

        const response = await POST(postRequest("Bearer super-secret-cron-token"));

        expect(response.status).toBe(200);
        expect(mockProcessDueSchedules).toHaveBeenCalled();
    });

    it("rejects everything when CRON_SECRET is not configured", async () => {
        delete process.env["CRON_SECRET"];
        const { POST } = await import("./route");

        const response = await POST(postRequest("Bearer anything"));

        expect(response.status).toBe(401);
        expect(mockProcessDueSchedules).not.toHaveBeenCalled();
    });
});
