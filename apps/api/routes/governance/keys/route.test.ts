import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

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

vi.mock("@/lib/auth", () => ({ getCurrentContext: mockGetCurrentContext }));
vi.mock("@/lib/governance/audit", () => ({ audit: mockAudit }));
vi.mock("@/lib/permissions", () => ({
  TeamRole: { ADMIN: "admin" },
  checkTeamPermission: mockCheckTeamPermission,
}));
vi.mock("@/lib/rateLimit", () => ({ applyRateLimit: mockApplyRateLimit }));
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

describe("governance API key route", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockConsoleWarn.mockClear();
    mockGetCurrentContext.mockResolvedValue({ userId: "admin-a", teamId: "team-a" });
    mockCheckTeamPermission.mockResolvedValue(true);
    mockApplyRateLimit.mockResolvedValue(null);
    mockListTeamApiKeys.mockResolvedValue({ keys: [metadata], total: 1 });
    mockCreateTeamApiKey.mockResolvedValue({
      apiKey: metadata,
      secret: "cmf_live_" + "c".repeat(64),
    });
    mockAudit.mockResolvedValue(undefined);
  });

  it("lists only metadata and caps the requested list size", async () => {
    const { GET } = await import("./route");
    const response = await GET(
      new Request("http://localhost/governance/keys?limit=999") as NextRequest
    );
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(payload.success).toBe(true);
    expect(payload.keys[0].key).toBeUndefined();
    expect(JSON.stringify(payload.keys)).not.toContain("v2:");
    expect(mockListTeamApiKeys).toHaveBeenCalledWith("team-a", 100, 0);
  });

  it("returns the raw secret only during creation and never in audit metadata", async () => {
    const { POST } = await import("./route");
    const response = await POST(new Request("http://localhost/governance/keys", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ name: "CRM" }),
    }) as NextRequest);
    const payload = await response.json();

    expect(response.status).toBe(201);
    expect(payload.success).toBe(true);
    expect(payload.secret).toMatch(/^cmf_live_[a-f0-9]{64}$/);
    expect(payload.apiKey.key).toBeUndefined();
    expect(JSON.stringify(mockAudit.mock.calls)).not.toContain(payload.secret);
  });

  it("denies non-admin creation", async () => {
    mockCheckTeamPermission.mockResolvedValue(false);
    const { POST } = await import("./route");
    const response = await POST(new Request("http://localhost/governance/keys", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ name: "CRM" }),
    }) as NextRequest);

    expect(response.status).toBe(403);
    expect(mockCreateTeamApiKey).not.toHaveBeenCalled();
  });

  // --- Audit-after-persistence tests ---

  it("returns 201 with secret when createTeamApiKey succeeds and audit succeeds", async () => {
    const { POST } = await import("./route");
    const response = await POST(new Request("http://localhost/governance/keys", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ name: "CRM" }),
    }) as NextRequest);
    const payload = await response.json();

    expect(response.status).toBe(201);
    expect(payload.success).toBe(true);
    expect(payload.secret).toMatch(/^cmf_live_/);
    expect(payload.apiKey).toMatchObject({ id: "key-1", name: "CRM" });
    expect(mockAudit).toHaveBeenCalledTimes(1);
  });

  it("returns 201 with secret when createTeamApiKey succeeds but audit throws", async () => {
    mockAudit.mockRejectedValueOnce(new Error("audit DB connection failed"));
    const { POST } = await import("./route");
    const response = await POST(new Request("http://localhost/governance/keys", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ name: "CRM" }),
    }) as NextRequest);
    const payload = await response.json();

    expect(response.status).toBe(201);
    expect(payload.success).toBe(true);
    expect(payload.secret).toMatch(/^cmf_live_[a-f0-9]{64}$/);
    expect(payload.apiKey).toMatchObject({ id: "key-1", name: "CRM" });
    expect(mockCreateTeamApiKey).toHaveBeenCalledTimes(1);
  });

  it("logs generic warning without secret or digest when audit throws", async () => {
    mockAudit.mockRejectedValueOnce(new Error("audit DB connection failed"));
    const { POST } = await import("./route");
    await POST(new Request("http://localhost/governance/keys", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ name: "CRM" }),
    }) as NextRequest);

    expect(mockConsoleWarn).toHaveBeenCalledWith(
      "[GovernanceKeys] Audit write failed after key creation",
      { apiKeyId: "key-1" }
    );
    // Verify no sensitive material in warn call
    const warnArgs = JSON.stringify(mockConsoleWarn.mock.calls);
    expect(warnArgs).not.toContain("cmf_live_");
    expect(warnArgs).not.toContain("v2:");
  });

  it("returns generic error when createTeamApiKey itself fails", async () => {
    mockCreateTeamApiKey.mockRejectedValueOnce(new Error("DB unreachable"));
    const { POST } = await import("./route");
    const response = await POST(new Request("http://localhost/governance/keys", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ name: "CRM" }),
    }) as NextRequest);
    const payload = await response.json();

    expect(response.status).toBe(500);
    expect(payload).toEqual({ success: false, error: "Unable to create API key" });
    expect(mockAudit).not.toHaveBeenCalled();
  });

  it("does not trigger a duplicate create call on audit failure", async () => {
    mockAudit.mockRejectedValueOnce(new Error("audit failure"));
    const { POST } = await import("./route");
    await POST(new Request("http://localhost/governance/keys", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ name: "CRM" }),
    }) as NextRequest);

    expect(mockCreateTeamApiKey).toHaveBeenCalledTimes(1);
  });

  it("passes only metadata to audit — no raw secret or lookup digest", async () => {
    const { POST } = await import("./route");
    await POST(new Request("http://localhost/governance/keys", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ name: "CRM" }),
    }) as NextRequest);

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
    expect(auditArgs).not.toContain("cmf_live_" + "c".repeat(64));
    expect(auditArgs).not.toContain("v2:");
  });
});
