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

const mockConsoleWarn = vi.spyOn(console, "warn").mockImplementation(() => {});

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
    mockConsoleWarn.mockClear();
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

  it("redacts one-time key material from an internal creation error response", async () => {
    const secret = "cmf_live_" + "e".repeat(64);
    mockCreateTeamApiKey.mockRejectedValueOnce(new Error(`persistence failed for ${secret}`));
    const { POST } = await import("./route");

    const response = await POST(request("http://localhost/settings/keys", { name: "CRM" }));
    const payload = await response.json();

    expect(response.status).toBe(500);
    expect(payload).toEqual({ error: "Unable to create API key" });
    expect(JSON.stringify(payload)).not.toContain(secret);
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

  // --- Audit-after-persistence tests ---

  it("returns 201 with secret when createTeamApiKey succeeds and audit succeeds", async () => {
    const { POST } = await import("./route");
    const response = await POST(request("http://localhost/settings/keys", { name: "CRM" }));
    const payload = await response.json();

    expect(response.status).toBe(201);
    expect(payload.secret).toMatch(/^cmf_live_/);
    expect(payload.apiKey).toMatchObject({ id: "key-1", name: "CRM" });
    expect(mockAudit).toHaveBeenCalledTimes(1);
  });

  it("returns 201 with secret when createTeamApiKey succeeds but audit throws", async () => {
    mockAudit.mockRejectedValueOnce(new Error("audit DB connection failed"));
    const { POST } = await import("./route");
    const response = await POST(request("http://localhost/settings/keys", { name: "CRM" }));
    const payload = await response.json();

    expect(response.status).toBe(201);
    expect(payload.secret).toMatch(/^cmf_live_[a-f0-9]{64}$/);
    expect(payload.apiKey).toMatchObject({ id: "key-1", name: "CRM" });
    expect(mockCreateTeamApiKey).toHaveBeenCalledTimes(1);
  });

  it("logs generic warning without secret or digest when audit throws", async () => {
    mockAudit.mockRejectedValueOnce(new Error("audit DB connection failed"));
    const { POST } = await import("./route");
    await POST(request("http://localhost/settings/keys", { name: "CRM" }));

    expect(mockConsoleWarn).toHaveBeenCalledWith(
      "[SettingsKeys] Audit write failed after key creation",
      { apiKeyId: "key-1" }
    );
    const warnArgs = JSON.stringify(mockConsoleWarn.mock.calls);
    expect(warnArgs).not.toContain("cmf_live_");
    expect(warnArgs).not.toContain("v2:");
  });

  it("returns generic error when createTeamApiKey itself fails", async () => {
    mockCreateTeamApiKey.mockRejectedValueOnce(new Error("DB unreachable"));
    const { POST } = await import("./route");
    const response = await POST(request("http://localhost/settings/keys", { name: "CRM" }));
    const payload = await response.json();

    expect(response.status).toBe(500);
    expect(payload).toEqual({ error: "Unable to create API key" });
    expect(mockAudit).not.toHaveBeenCalled();
  });

  it("does not trigger a duplicate create call on audit failure", async () => {
    mockAudit.mockRejectedValueOnce(new Error("audit failure"));
    const { POST } = await import("./route");
    await POST(request("http://localhost/settings/keys", { name: "CRM" }));

    expect(mockCreateTeamApiKey).toHaveBeenCalledTimes(1);
  });

  it("passes only metadata to audit — no raw secret or lookup digest", async () => {
    const { POST } = await import("./route");
    await POST(request("http://localhost/settings/keys", { name: "CRM" }));

    expect(mockAudit).toHaveBeenCalledWith({
      actorId: "admin-a",
      orgId: "team-a",
      action: "API_KEY_CREATED",
      entity: "ApiKey",
      entityId: "key-1",
      metadata: {
        name: "CRM",
        scopes: ["leads:read"],
        keyPrefix: "cmf_live_",
        keyLastFour: "cdef",
      },
    });
    const auditArgs = JSON.stringify(mockAudit.mock.calls);
    expect(auditArgs).not.toContain("cmf_live_" + "a".repeat(64));
    expect(auditArgs).not.toContain("v2:");
  });
});
