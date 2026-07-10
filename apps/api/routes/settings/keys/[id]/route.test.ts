import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest, NextResponse } from "next/server";

const {
  mockApplyRateLimit,
  mockAudit,
  mockCheckTeamPermission,
  mockGetCurrentContext,
  mockRevokeTeamApiKey,
} = vi.hoisted(() => ({
  mockApplyRateLimit: vi.fn(),
  mockAudit: vi.fn(),
  mockCheckTeamPermission: vi.fn(),
  mockGetCurrentContext: vi.fn(),
  mockRevokeTeamApiKey: vi.fn(),
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
  revokeTeamApiKey: mockRevokeTeamApiKey,
}));

function request() {
  return new Request("http://localhost/settings/keys/key-b", {
    method: "DELETE",
  }) as NextRequest;
}

const params = { params: Promise.resolve({ id: "key-b" }) };

describe("settings API key revocation route", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetCurrentContext.mockResolvedValue({ userId: "admin-a", teamId: "team-a" });
    mockCheckTeamPermission.mockResolvedValue(true);
    mockApplyRateLimit.mockResolvedValue(null);
    mockAudit.mockResolvedValue(undefined);
  });

  it("prevents bare-ID cross-team revocation", async () => {
    mockRevokeTeamApiKey.mockResolvedValue({
      found: false,
      revoked: false,
      alreadyRevoked: false,
    });
    const { DELETE } = await import("./route");

    const response = await DELETE(request(), params);

    expect(response.status).toBe(404);
    expect(mockRevokeTeamApiKey).toHaveBeenCalledWith("team-a", "key-b");
    expect(mockAudit).not.toHaveBeenCalled();
  });

  it("revokes an active key and writes a redacted audit event", async () => {
    mockRevokeTeamApiKey.mockResolvedValue({
      found: true,
      revoked: true,
      alreadyRevoked: false,
    });
    const { DELETE } = await import("./route");

    const response = await DELETE(request(), params);
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(payload).toEqual({ success: true, revoked: true, alreadyRevoked: false });
    expect(mockAudit).toHaveBeenCalledWith({
      actorId: "admin-a",
      orgId: "team-a",
      action: "API_KEY_REVOKED",
      entity: "ApiKey",
      entityId: "key-b",
      metadata: {},
    });
  });

  it("makes repeat revocation idempotent", async () => {
    mockRevokeTeamApiKey.mockResolvedValue({
      found: true,
      revoked: false,
      alreadyRevoked: true,
    });
    const { DELETE } = await import("./route");

    const response = await DELETE(request(), params);

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({
      success: true,
      revoked: false,
      alreadyRevoked: true,
    });
    expect(mockAudit).not.toHaveBeenCalled();
  });

  it("denies non-admins and rate-limits revocation", async () => {
    mockCheckTeamPermission.mockResolvedValue(false);
    const { DELETE } = await import("./route");
    const denied = await DELETE(request(), params);
    expect(denied.status).toBe(403);

    mockCheckTeamPermission.mockResolvedValue(true);
    mockApplyRateLimit.mockResolvedValue(
      NextResponse.json({ error: "Rate limit exceeded" }, { status: 429 })
    );
    const limited = await DELETE(request(), params);
    expect(limited.status).toBe(429);
  });
});
