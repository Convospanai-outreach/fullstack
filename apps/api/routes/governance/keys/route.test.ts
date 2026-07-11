import { beforeEach, describe, expect, it, vi } from "vitest";

const {
    mockAudit,
    mockCheckTeamPermission,
    mockGetCurrentContext,
    mockPrisma,
} = vi.hoisted(() => ({
    mockAudit: vi.fn(),
    mockCheckTeamPermission: vi.fn(),
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
    checkTeamPermission: mockCheckTeamPermission,
}));

vi.mock("@/lib/governance/audit", () => ({
    audit: mockAudit,
}));

import { NEW_API_KEY_PREFIX, createStoredApiKeyValue } from "@/lib/apiKeySecurity";

const createdAt = new Date("2026-07-11T00:00:00.000Z");
const newSecret = NEW_API_KEY_PREFIX + "c".repeat(64);

describe("/governance/keys", () => {
    beforeEach(() => {
        vi.clearAllMocks();
        mockGetCurrentContext.mockResolvedValue({ userId: "user-1", teamId: "team-1" });
        mockCheckTeamPermission.mockResolvedValue(true);
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

    it("creates metadata plus one-time raw key without persisting the raw key", async () => {
        const { POST } = await import("./route");

        const response = await POST(new Request("http://localhost/governance/keys", {
            method: "POST",
            headers: { "content-type": "application/json" },
            body: JSON.stringify({ name: "Governance", scopes: ["campaigns:write"] }),
        }));
        const payload = await response.json();
        const createArgs = mockPrisma.apiKey.create.mock.calls[0][0];

        expect(response.status).toBe(200);
        expect(payload.success).toBe(true);
        expect(payload.key.key).toMatch(/^cmf_live_[a-f0-9]{64}$/);
        expect(createArgs.data.key).toMatch(/^cmf_sha256_v1:[a-f0-9]{4}:[a-f0-9]{64}$/);
        expect(createArgs.data.key).not.toContain(payload.key.key);
        expect(createArgs.data.scopes).toEqual(["campaigns:write"]);
        expect(JSON.stringify(mockAudit.mock.calls)).not.toContain(payload.key.key);
    });

    it("returns metadata-only listings for new and legacy records", async () => {
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
                key: "cs_live_" + "d".repeat(48),
            },
        ]);

        const { GET } = await import("./route");
        const response = await GET();
        const payload = await response.json();
        const serialized = JSON.stringify(payload);

        expect(payload.keys).toMatchObject([
            { id: "key-new", key: `${NEW_API_KEY_PREFIX}...cccc`, legacy: false },
            { id: "key-legacy", key: "cs_live_...dddd", legacy: true },
        ]);
        expect(serialized).not.toContain(newSecret);
        expect(serialized).not.toContain(createStoredApiKeyValue(newSecret));
        expect(serialized).not.toContain("cs_live_" + "d".repeat(48));
    });

    it("rejects unknown scopes", async () => {
        const { POST } = await import("./route");

        const response = await POST(new Request("http://localhost/governance/keys", {
            method: "POST",
            headers: { "content-type": "application/json" },
            body: JSON.stringify({ scopes: ["unknown:scope"] }),
        }));

        expect(response.status).toBe(400);
        expect(mockPrisma.apiKey.create).not.toHaveBeenCalled();
    });
});
