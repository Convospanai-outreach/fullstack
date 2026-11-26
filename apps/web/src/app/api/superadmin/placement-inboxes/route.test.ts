import { beforeEach, describe, expect, it, vi } from "vitest";

const m = vi.hoisted(() => ({
    actor: vi.fn(),
    audit: vi.fn(),
    encrypt: vi.fn(async (plain: string) => ({ v: 1, cipher: `enc(${plain.length})`, iv: "iv", tag: "tag" })),
    findMany: vi.fn(),
    findUnique: vi.fn(),
    create: vi.fn(),
    deleteMany: vi.fn(),
}));

vi.mock("@/lib/superadmin/actor", () => ({ getSuperAdminActor: m.actor, auditSuperAdmin: m.audit }));
vi.mock("@/lib/security/credentialVault", () => ({ encryptCredential: m.encrypt }));
vi.mock("@/lib/db", () => ({ prisma: { warmupSeedMailbox: { findMany: m.findMany, findUnique: m.findUnique, create: m.create, deleteMany: m.deleteMany } } }));

import { DELETE } from "./[id]/route";
import { GET, POST } from "./route";

const post = (body: unknown) => new Request("http://x/api/superadmin/placement-inboxes", { method: "POST", body: JSON.stringify(body) }) as any;

beforeEach(() => {
    vi.clearAllMocks();
    m.actor.mockResolvedValue({ id: "sa1", email: "ops@x.test", enterpriseRole: "SUPER_ADMIN" });
    m.findUnique.mockResolvedValue(null);
    m.create.mockImplementation(async ({ data }: any) => ({ id: "i1", email: data.email, host: data.host, port: data.port, user: data.user, createdAt: new Date() }));
});

describe("superadmin placement inboxes", () => {
    it("requires a super admin", async () => {
        m.actor.mockResolvedValue(null);
        expect((await GET()).status).toBe(401);
        expect((await POST(post({}))).status).toBe(401);
    });

    it("lists only PLACEMENT rows and never returns the password", async () => {
        m.findMany.mockResolvedValue([{ id: "i1", email: "t@gmail.com", host: "imap.gmail.com", port: 993, user: "t@gmail.com", createdAt: new Date() }]);
        await GET();
        const args = m.findMany.mock.calls[0]![0];
        expect(args.where).toEqual({ status: "PLACEMENT" });
        expect(args.select).not.toHaveProperty("encryptedPassword");
    });

    it("stores the app password encrypted as a PLACEMENT row and audits it", async () => {
        const res = await POST(post({ email: "Test@Gmail.com", imapHost: "imap.gmail.com", password: "app-pass" }));
        expect(res.status).toBe(201);
        const { data, select } = m.create.mock.calls[0]![0];
        expect(data).toMatchObject({ email: "test@gmail.com", host: "imap.gmail.com", port: 993, secure: true, user: "test@gmail.com", status: "PLACEMENT" });
        expect(data.encryptedPassword).toEqual({ v: 1, cipher: "enc(8)", iv: "iv", tag: "tag" });
        expect(JSON.stringify(data)).not.toContain("app-pass");
        expect(select).not.toHaveProperty("encryptedPassword");
        expect(m.audit).toHaveBeenCalledWith(expect.anything(), "PLACEMENT_INBOX_ADD", expect.anything(), { email: "test@gmail.com", imapHost: "imap.gmail.com" });
    });

    it("rejects a bad host or an address already used as a warmup seed", async () => {
        expect((await POST(post({ email: "t@gmail.com", imapHost: "not a host", password: "x" }))).status).toBe(400);
        m.findUnique.mockResolvedValue({ status: "ACTIVE" });
        expect((await POST(post({ email: "t@gmail.com", imapHost: "imap.gmail.com", password: "x" }))).status).toBe(409);
        expect(m.create).not.toHaveBeenCalled();
    });

    it("deletes only PLACEMENT rows", async () => {
        m.deleteMany.mockResolvedValue({ count: 0 });
        const res = await DELETE(new Request("http://x", { method: "DELETE" }) as any, { params: Promise.resolve({ id: "seed-1" }) });
        expect(res.status).toBe(404);
        expect(m.deleteMany).toHaveBeenCalledWith({ where: { id: "seed-1", status: "PLACEMENT" } });
    });
});
