import { beforeEach, describe, expect, it, vi } from "vitest";

const { mockCheckAdmin, upsert, applyRedisSwitch } = vi.hoisted(() => ({
    mockCheckAdmin: vi.fn(),
    upsert: vi.fn(),
    applyRedisSwitch: vi.fn(),
}));

vi.mock("@/lib/admin", () => ({ checkAdmin: mockCheckAdmin }));
vi.mock("@/lib/db", () => ({ prisma: { featureFlag: { upsert } } }));
vi.mock("@/lib/redis", () => ({
    REDIS_SWITCH_KEY: "system_redis",
    applyRedisSwitch,
    getRedisClient: vi.fn(),
    getRedisStatus: () => ({ state: "not_configured", switchEnabled: true, urlConfigured: false }),
}));

import { GET, POST } from "./route";

const post = (body: unknown) =>
    POST(new Request("http://localhost/admin/super/redis", { method: "POST", body: JSON.stringify(body) }));

describe("super admin redis route", () => {
    beforeEach(() => {
        vi.clearAllMocks();
        mockCheckAdmin.mockResolvedValue(true);
        applyRedisSwitch.mockResolvedValue({ state: "off", switchEnabled: false });
    });

    it("is super admin only", async () => {
        mockCheckAdmin.mockResolvedValue(false);
        expect((await GET()).status).toBe(403);
        expect((await post({ enabled: false })).status).toBe(403);
        expect(upsert).not.toHaveBeenCalled();
    });

    it("returns the status", async () => {
        const res = await GET();
        expect(res.status).toBe(200);
        expect(await res.json()).toMatchObject({ state: "not_configured" });
    });

    it("stores the switch and applies it", async () => {
        const res = await post({ enabled: false });
        expect(res.status).toBe(200);
        expect(upsert).toHaveBeenCalledWith(expect.objectContaining({
            where: { key: "system_redis" },
            update: { isEnabled: false },
        }));
        expect(applyRedisSwitch).toHaveBeenCalledWith(false);
        expect(await res.json()).toMatchObject({ state: "off" });
    });

    it("rejects anything but a boolean", async () => {
        expect((await post({ enabled: "yes" })).status).toBe(400);
        expect(upsert).not.toHaveBeenCalled();
    });
});
