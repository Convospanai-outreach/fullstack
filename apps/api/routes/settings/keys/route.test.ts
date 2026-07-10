import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest, NextResponse } from "next/server";

const {
  mockApplyRateLimit,
  mockAudit,
  mockCheckTeamPermission,
  mockCreateTeamApiKey,
  mockGetCurrentContext,
  mockListTeamApiKeys,
} = vi.hoisted(() => ({
  mockApplyRateLimit: vi.fn(),
  mockAudit: vi.fn(),
  mockCheckTeamPermission: vi.fn(),
  mockCreateTeamApiKey: vi.fn(),
  mockGetCurrentContext: vi.fn(),
  mockListTeamApiKeys: vi.fn(),
}));

vi.mock("@/lib/auth", () => ({
  getCurrentContext: mockGetCurrentContext,
}));
vi.mock("@/lib/governance/audit", () => ({
  audit: mockAudit,
}));
vi.mock("@/lib/permissions", () => ({
  TeamRole: { ADMIN: "admin" },
  checkTeamPermission: mockCheckTeamPermission,
}));
vi.mock("@/lib/rateLimit", () => ({
  applyRateLimit: mockApplyRateLimit,
}));
vi.mock("@/lib/apiKeyService", () => ({
  createTeamApiKey: mockCreateTeamApiKey,
  listTeamApiKeys: mockListTeamApiKeys,
}));

const metadata = {
  id: "key-1",
  name: "CRM",
  scopes: ["leads:read"],
  lastUsedAt: null,
  isActive: true,
  createdAt: new Date("2026-07-10T00:00:00.000Z"),
  keyPrefix: "cmf_live_",
  keyLastFour: "cdef",
  legacy: false,
};

function request(url: string, body?: unknown) {
  return new Request(url, body === undefined ? undefined : {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  }) as NextRequest;
}

describe("settings API key routes", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetCurrentContext.mockResolvedValue({ userId: "admin-a", teamId: "team-a" });
    mockCheckTeamPermission.mockResolvedValue(true);
    mockApplyRateLimit.mockResolvedValue(null);
    mockListTeamApiKeys.mockResolvedValue({ keys: [metadata], total: 1 });
    mockCreateTeamApiKey.mockResolvedValue({
      apiKey: metadata,
      secret: "cmf_live_" + "a".repeat(64),
    });
    mockAudit.mockResolvedValue(undefined);
  });

  it("returns a bounded metadata-only list with no raw key or lookup hash", async () => {
    const { GET } = await import("./route");
    const response = await GET(request("http://localhost/settings/keys?limit=999"));

    const payload = await response.json();
    expect(response.status).toBe(200);
    expect(payload.meta.limit).toBe(100);
    expect(payload.data[0]).toMatchObject({
      id: "key-1",
      keyPrefix: "cmf_live_",
      keyLastFour: "cdef",
    });
    expect(JSON.stringify(payload.data)).not.toContain("v2:");
    expect(payload.data[0].key).toBeUndefined();
    expect(mockListTeamApiKeys).toHaveBeenCalledWith("team-a", 100, 0);
  });

  it("returns the raw secret only in the one-time creation response and audits safe metadata", async () => {
    const { POST } = await import("./route");
    const response = await POST(request("http://localhost/settings/keys", { name: "CRM" }));

    const payload = await response.json();
    expect(response.status).toBe(201);
    expect(payload.apiKey).toMatchObject({
      id: "key-1",
      name: "CRM",
      scopes: ["leads:read"],
      keyPrefix: "cmf_live_",
      keyLastFour: "cdef",
    });
    expect(payload.secret).toMatch(/^cmf_live_[a-f0-9]{64}$/);
    expect(payload.apiKey.key).toBeUndefined();
    expect(mockCreateTeamApiKey).toHaveBeenCalledWith("team-a", "CRM", ["leads:read"]);
    expect(mockAudit).toHaveBeenCalledWith(expect.objectContaining({
      metadata: expect.objectContaining({
        name: "CRM",
        scopes: ["leads:read"],
      }),
    }));
    expect(JSON.stringify(mockAudit.mock.calls)).not.toContain(payload.secret);
  });

  it("rejects unknown and duplicate scopes before key creation", async () => {
    const { POST } = await import("./route");

    const unknown = await POST(request("http://localhost/settings/keys", {
      name: "CRM",
      scopes: ["unknown:scope"],
    }));
    const duplicate = await POST(request("http://localhost/settings/keys", {
      name: "CRM",
      scopes: ["leads:read", "leads:read"],
    }));

    expect(unknown.status).toBe(400);
    expect(duplicate.status).toBe(400);
    expect(mockCreateTeamApiKey).not.toHaveBeenCalled();
  });

  it("denies non-admin key management", async () => {
    mockCheckTeamPermission.mockResolvedValue(false);
    const { POST } = await import("./route");

    const response = await POST(request("http://localhost/settings/keys", { name: "CRM" }));

    expect(response.status).toBe(403);
    expect(mockCreateTeamApiKey).not.toHaveBeenCalled();
  });

  it("returns the explicit rate-limit response for sensitive creation", async () => {
    mockApplyRateLimit.mockResolvedValue(
      NextResponse.json({ error: "Rate limit exceeded" }, { status: 429 })
    );
    const { POST } = await import("./route");

    const response = await POST(request("http://localhost/settings/keys", { name: "CRM" }));

    expect(response.status).toBe(429);
    expect(mockCreateTeamApiKey).not.toHaveBeenCalled();
  });
});
