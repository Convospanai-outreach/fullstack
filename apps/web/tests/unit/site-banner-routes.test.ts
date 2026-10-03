import { beforeEach, describe, expect, it, vi } from "vitest";

const { getSuperAdminUserId, prisma } = vi.hoisted(() => ({
    getSuperAdminUserId: vi.fn(),
    prisma: {
        user: { findUnique: vi.fn() },
        superAdminAuditLog: { create: vi.fn() },
        siteBanner: { findUnique: vi.fn(), upsert: vi.fn() },
    },
}));

vi.mock("@/lib/superadmin/session", () => ({ getSuperAdminUserId }));
vi.mock("@/lib/db", () => ({ prisma }));

import { PUT } from "../../src/app/api/superadmin/banner/route";

const put = (body: unknown) => PUT(new Request("http://localhost/api/superadmin/banner", { method: "PUT", body: JSON.stringify(body) }) as any);

describe("site banner", () => {
    beforeEach(() => {
        vi.clearAllMocks();
        getSuperAdminUserId.mockResolvedValue("sa-1");
        prisma.user.findUnique.mockResolvedValue({ id: "sa-1", email: "ops@example.com", enterpriseRole: "SYSTEM_ADMIN", superAdminCredential: { id: "c" } });
        prisma.siteBanner.upsert.mockImplementation(async ({ update }: any) => update);
    });

    it("needs a superadmin session to change it", async () => {
        getSuperAdminUserId.mockResolvedValue(null);
        expect((await put({ message: "x", level: "info", active: true })).status).toBe(401);
        expect(prisma.siteBanner.upsert).not.toHaveBeenCalled();
    });

    it("sets and turns off the notice, with audit rows", async () => {
        expect((await put({ message: "  Sending is delayed  ", level: "warning", active: true })).status).toBe(200);
        expect(prisma.siteBanner.upsert).toHaveBeenCalledWith(
            expect.objectContaining({ where: { id: "site" }, update: { message: "Sending is delayed", level: "warning", active: true, updatedById: "sa-1" } })
        );
        await put({ message: "Sending is delayed", level: "warning", active: false });
        expect(prisma.superAdminAuditLog.create.mock.calls.map(([a]: any[]) => a.data.action)).toEqual(["BANNER_SET", "BANNER_OFF"]);
    });

    it("rejects an empty active notice, an unknown level and an overlong message", async () => {
        expect((await put({ message: "", level: "info", active: true })).status).toBe(400);
        expect((await put({ message: "x", level: "loud", active: true })).status).toBe(400);
        expect((await put({ message: "x".repeat(501), level: "info", active: true })).status).toBe(400);
        expect(prisma.siteBanner.upsert).not.toHaveBeenCalled();
    });

    it("serves only an active notice to users, cached between requests", async () => {
        const { GET } = await import("../../src/app/api/site-banner/route");
        prisma.siteBanner.findUnique.mockResolvedValue({ message: "Back soon", level: "maintenance", active: true });
        expect(await (await GET()).json()).toEqual({ banner: { message: "Back soon", level: "maintenance" } });
        prisma.siteBanner.findUnique.mockResolvedValue({ message: "Back soon", level: "maintenance", active: false });
        expect(await (await GET()).json()).toEqual({ banner: { message: "Back soon", level: "maintenance" } });
        expect(prisma.siteBanner.findUnique).toHaveBeenCalledTimes(1);
    });
});
