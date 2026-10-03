import { beforeEach, describe, expect, it, vi } from "vitest";

const { mockCheckAdmin, featureFlag } = vi.hoisted(() => ({
    mockCheckAdmin: vi.fn(),
    featureFlag: { findMany: vi.fn(), upsert: vi.fn(), deleteMany: vi.fn() },
}));

vi.mock("@/lib/admin", () => ({ checkAdmin: mockCheckAdmin }));
vi.mock("@/lib/db", () => ({ prisma: { featureFlag } }));

import { GET, POST } from "./route";

const post = (body: unknown) => POST(new Request("http://localhost/admin/super/flags", { method: "POST", body: JSON.stringify(body) }));

describe("super admin feature flags route", () => {
    beforeEach(() => {
        vi.clearAllMocks();
        mockCheckAdmin.mockResolvedValue(true);
        featureFlag.findMany.mockResolvedValue([{ key: "whatsapp_outbound", isEnabled: true, updatedAt: new Date("2026-10-03T00:00:00Z") }]);
    });

    it("is super admin only", async () => {
        mockCheckAdmin.mockResolvedValue(false);
        expect((await GET()).status).toBe(403);
        expect((await post({ key: "ai_drafting", enabled: false })).status).toBe(403);
        expect(featureFlag.upsert).not.toHaveBeenCalled();
    });

    it("lists every defined flag with its default and override", async () => {
        const { flags } = await (await GET()).json();
        expect(flags.map((f: any) => f.key)).toEqual(["email_sequences", "ai_drafting", "linkedin_automation", "autonomous_agents", "whatsapp_outbound"]);
        expect(flags.find((f: any) => f.key === "whatsapp_outbound")).toMatchObject({ defaultValue: false, override: true });
        expect(flags.find((f: any) => f.key === "ai_drafting")).toMatchObject({ defaultValue: true, override: null });
    });

    it("sets and clears an override", async () => {
        expect((await post({ key: "ai_drafting", enabled: false })).status).toBe(200);
        expect(featureFlag.upsert).toHaveBeenCalledWith(expect.objectContaining({ where: { key: "ai_drafting" }, update: { isEnabled: false } }));

        expect((await post({ key: "ai_drafting", enabled: null })).status).toBe(200);
        expect(featureFlag.deleteMany).toHaveBeenCalledWith({ where: { key: "ai_drafting" } });
    });

    it("refuses unknown keys, including the Redis and platform switch rows", async () => {
        expect((await post({ key: "system_redis", enabled: true })).status).toBe(400);
        expect((await post({ key: "hidden_feature:whatsapp", enabled: true })).status).toBe(400);
        expect((await post({ key: "ai_drafting", enabled: "yes" })).status).toBe(400);
        expect(featureFlag.upsert).not.toHaveBeenCalled();
    });
});
