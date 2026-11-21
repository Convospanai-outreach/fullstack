import { beforeEach, describe, expect, it, vi } from "vitest";

const { mockGetAdminUser, lead, auditLog } = vi.hoisted(() => ({
    mockGetAdminUser: vi.fn(),
    lead: { findMany: vi.fn(), count: vi.fn() },
    auditLog: { create: vi.fn() },
}));

vi.mock("@/lib/admin", () => ({ getAdminUser: mockGetAdminUser }));
vi.mock("@/lib/db", () => ({ prisma: { lead, auditLog } }));

import { GET } from "./route";

const TEAM = "11111111-1111-4111-8111-111111111111";
const get = (query: string) => GET(new Request(`http://localhost/admin/super/breach-export?${query}`));
const GOOD = `teamId=${TEAM}&from=2026-11-01T00:00:00Z&to=2026-11-10T00:00:00Z`;

describe("super admin breach export", () => {
    beforeEach(() => {
        vi.clearAllMocks();
        mockGetAdminUser.mockResolvedValue({ id: "admin-1", role: "ADMIN", enterpriseRole: "SYSTEM_ADMIN" });
        lead.count.mockResolvedValue(1);
        lead.findMany.mockResolvedValue([{ id: "l1", fullName: "Asha Rao", email: "asha@acme.example", phone: "+919876543210", company: "Acme", source: "CSV_IMPORT", createdAt: new Date("2026-11-05T10:00:00Z") }]);
        auditLog.create.mockResolvedValue({});
    });

    it("refuses anyone who is not a super admin, and reads and records nothing", async () => {
        mockGetAdminUser.mockResolvedValue(null);

        const res = await get(GOOD);

        expect(res.status).toBe(403);
        expect(lead.findMany).not.toHaveBeenCalled();
        expect(lead.count).not.toHaveBeenCalled();
        expect(auditLog.create).not.toHaveBeenCalled();
    });

    it("asks for a team and a valid time window", async () => {
        for (const q of ["", `teamId=${TEAM}`, `teamId=nope&from=2026-11-01&to=2026-11-02`, `teamId=${TEAM}&from=2026-11-10&to=2026-11-01`, `teamId=${TEAM}&from=x&to=y`]) {
            expect((await get(q)).status).toBe(400);
        }
        expect(lead.findMany).not.toHaveBeenCalled();
        expect(auditLog.create).not.toHaveBeenCalled();
    });

    it("exports the team's leads created in the window as a CSV", async () => {
        const res = await get(GOOD);
        const csv = await res.text();

        expect(res.status).toBe(200);
        expect(res.headers.get("content-type")).toContain("text/csv");
        expect(csv).toContain("asha@acme.example");
        expect(csv).toContain("+919876543210".replace("+", "'+"));
        expect(lead.findMany).toHaveBeenCalledWith(expect.objectContaining({
            where: { teamId: TEAM, createdAt: { gte: new Date("2026-11-01T00:00:00Z"), lte: new Date("2026-11-10T00:00:00Z") } },
        }));
    });

    it("writes an AuditLog row for the team, naming the admin, the window and the count, with no lead data in it", async () => {
        await (await get(GOOD)).text();

        expect(auditLog.create).toHaveBeenCalledTimes(1);
        const data = auditLog.create.mock.calls[0][0].data;
        expect(data).toMatchObject({ orgId: TEAM, actorId: "admin-1", action: "BREACH_EXPORT", entity: "Lead" });
        expect(data.metadata).toMatchObject({ count: 1, from: "2026-11-01T00:00:00.000Z", to: "2026-11-10T00:00:00.000Z" });
        expect(JSON.stringify(data)).not.toContain("asha@acme.example");
    });

    it("writes the AuditLog row before any lead data is read, and exports nothing if it cannot be written", async () => {
        auditLog.create.mockRejectedValue(new Error("db down"));

        const res = await get(GOOD);

        expect(res.status).toBe(500);
        expect(lead.findMany).not.toHaveBeenCalled();
    });

    it("keeps a spreadsheet from running a formula in a name", async () => {
        lead.findMany.mockResolvedValue([{ id: "l1", fullName: "=HYPERLINK(\"x\")", email: null, phone: null, company: null, source: null, createdAt: new Date("2026-11-05T10:00:00Z") }]);

        const csv = await (await get(GOOD)).text();

        expect(csv).toContain("\"'=HYPERLINK");
    });
});
