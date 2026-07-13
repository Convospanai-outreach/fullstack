import { beforeEach, describe, expect, it, vi } from "vitest";

const {
    mockAudit,
    mockAuthorizeRole,
    mockGetCurrentContext,
    mockPrisma,
} = vi.hoisted(() => ({
    mockAudit: vi.fn(),
    mockAuthorizeRole: vi.fn(),
    mockGetCurrentContext: vi.fn(),
    mockPrisma: {
        apiKey: {
            create: vi.fn(),
            findMany: vi.fn(),
        },
    },
}));

vi.mock("@/lib/auth", () => ({
    getCurrentContext: mockGetCurrentContext,
}));

vi.mock("@/lib/db", () => ({
    prisma: mockPrisma,
}));

vi.mock("@/lib/logger", () => ({
    logger: { error: vi.fn() },
}));

vi.mock("@/lib/permissions", () => ({
    TeamRole: { ADMIN: "admin" },
    authorizeRole: mockAuthorizeRole,
}));

vi.mock("@/lib/governance/audit", () => ({
    audit: mockAudit,
}));

import { NEW_API_KEY_PREFIX, createStoredApiKeyValue } from "@/lib/apiKeySecurity";

const createdAt = new Date("2026-07-11T00:00:00.000Z");
const newSecret = NEW_API_KEY_PREFIX + "a".repeat(64);

describe("/settings/keys", () => {
    beforeEach(() => {
        vi.clearAllMocks();
        mockGetCurrentContext.mockResolvedValue({ userId: "user-1", teamId: "team-1" });
        mockAuthorizeRole.mockResolvedValue(undefined);
        mockAudit.mockResolvedValue(undefined);
        mockPrisma.apiKey.create.mockImplementation(async ({ data }) => ({
            id: "key-1",
            name: data.name,
            scopes: data.scopes,
            key: data.key,
            isActive: true,
            lastUsedAt: null,
            createdAt,
        }));
    });

    it("creates a new key with digest storage and one-time raw response", async () => {
        const { POST } = await import("./route");

        const response = await POST(new Request("http://localhost/settings/keys", {
            method: "POST",
            headers: { "content-type": "application/json" },
            body: JSON.stringify({ name: "CRM", scopes: ["leads:read", "tasks:write"] }),
        }) as any);
        const payload = await response.json();
        const createArgs = mockPrisma.apiKey.create.mock.calls[0][0];

        expect(response.status).toBe(200);
        expect(payload.secret).toMatch(/^cmf_live_[a-f0-9]{64}$/);
        expect(createArgs.data.key).toMatch(/^cmf_sha256_v1:[a-f0-9]{4}:[a-f0-9]{64}$/);
        expect(createArgs.data.key).not.toContain(payload.secret);
        expect(createArgs.data).toMatchObject({
            teamId: "team-1",
            name: "CRM",
            scopes: ["leads:read", "tasks:write"],
        });
        expect(payload).toMatchObject({
            id: "key-1",
            keyPrefix: NEW_API_KEY_PREFIX,
            keyLastFour: payload.secret.slice(-4),
            legacy: false,
        });
        expect(JSON.stringify(mockAudit.mock.calls)).not.toContain(payload.secret);
    });

    it("returns a created secret even when audit logging fails after persistence", async () => {
        mockAudit.mockRejectedValue(new Error("audit down"));
        const { POST } = await import("./route");

        const response = await POST(new Request("http://localhost/settings/keys", {
            method: "POST",
            headers: { "content-type": "application/json" },
            body: JSON.stringify({ name: "CRM", scopes: ["leads:read"] }),
        }) as any);
        const payload = await response.json();

        expect(response.status).toBe(200);
        expect(payload.secret).toMatch(/^cmf_live_[a-f0-9]{64}$/);
        expect(mockPrisma.apiKey.create).toHaveBeenCalledOnce();
    });

    it("returns metadata-only key listings", async () => {
        mockPrisma.apiKey.findMany.mockResolvedValue([
            {
                id: "key-new",
                name: "New",
                scopes: ["leads:read"],
                lastUsedAt: null,
                isActive: true,
                createdAt,
                key: createStoredApiKeyValue(newSecret),
            },
            {
                id: "key-legacy",
                name: "Legacy",
                scopes: ["leads:read"],
                lastUsedAt: null,
                isActive: true,
                createdAt,
                key: "sk_live_" + "b".repeat(48),
            },
        ]);

        const { GET } = await import("./route");
        const response = await GET(new Request("http://localhost/settings/keys") as any);
        const payload = await response.json();
        const serialized = JSON.stringify(payload);

        expect(payload).toMatchObject([
            { id: "key-new", displayKey: `${NEW_API_KEY_PREFIX}...aaaa`, legacy: false },
            { id: "key-legacy", displayKey: "sk_live_...bbbb", legacy: true },
        ]);
        expect(serialized).not.toContain(newSecret);
        expect(serialized).not.toContain(createStoredApiKeyValue(newSecret));
        expect(serialized).not.toContain("sk_live_" + "b".repeat(48));
    });

    it("rejects unknown scopes without creating a key", async () => {
        const { POST } = await import("./route");

        const response = await POST(new Request("http://localhost/settings/keys", {
            method: "POST",
            headers: { "content-type": "application/json" },
            body: JSON.stringify({ scopes: ["unknown:scope"] }),
        }) as any);

        expect(response.status).toBe(400);
        expect(mockPrisma.apiKey.create).not.toHaveBeenCalled();
    });

    it("requires explicit scopes", async () => {
        const { POST } = await import("./route");

        const response = await POST(new Request("http://localhost/settings/keys", {
            method: "POST",
            headers: { "content-type": "application/json" },
            body: JSON.stringify({ name: "Missing scopes" }),
        }) as any);

        expect(response.status).toBe(400);
        expect(mockPrisma.apiKey.create).not.toHaveBeenCalled();
    });
});
