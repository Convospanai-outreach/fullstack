import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const { mockPrisma } = vi.hoisted(() => ({
  mockPrisma: {
    user: {
      findUnique: vi.fn(),
    },
    session: {
      findUnique: vi.fn(),
    },
  },
}));

vi.mock("@/lib/db", () => ({
  prisma: mockPrisma,
}));

import { validateExtensionAuth } from "./auth";

function request(opts: { key?: string; bearer?: string } = {}) {
  const headers: Record<string, string> = {};
  if (opts.key !== undefined) headers["x-extension-key"] = opts.key;
  if (opts.bearer !== undefined) headers["authorization"] = `Bearer ${opts.bearer}`;
  return new Request("http://localhost/api/extension/leads/capture", { headers }) as any;
}

describe("validateExtensionAuth", () => {
  const originalKey = process.env["EXTENSION_API_KEY"];
  const originalFallback = process.env["EXTENSION_ALLOW_LEGACY_IDENTITY_FALLBACKS"];

  beforeEach(() => {
    vi.clearAllMocks();
    delete process.env["EXTENSION_API_KEY"];
    delete process.env["EXTENSION_ALLOW_LEGACY_IDENTITY_FALLBACKS"];
  });

  afterEach(() => {
    if (originalKey === undefined) delete process.env["EXTENSION_API_KEY"];
    else process.env["EXTENSION_API_KEY"] = originalKey;
    if (originalFallback === undefined) delete process.env["EXTENSION_ALLOW_LEGACY_IDENTITY_FALLBACKS"];
    else process.env["EXTENSION_ALLOW_LEGACY_IDENTITY_FALLBACKS"] = originalFallback;
  });

  const validSession = () => ({ userId: "user-1", expires: new Date(Date.now() + 60_000) });
  const activeUser = () => ({ id: "user-1", email: "u@example.com", name: "User", memberships: [{ teamId: "team-a" }] });

  it("accepts a valid sync token with no extension key header and no EXTENSION_API_KEY set", async () => {
    mockPrisma.session.findUnique.mockResolvedValue(validSession());
    mockPrisma.user.findUnique.mockResolvedValue(activeUser());

    const result = await validateExtensionAuth(request({ bearer: "valid-token" }));

    expect(result).toMatchObject({ ok: true, teamIds: ["team-a"] });
    expect(mockPrisma.session.findUnique).toHaveBeenCalledWith(expect.objectContaining({ where: { sessionToken: "valid-token" } }));
  });

  it("still accepts older extension builds that send an x-extension-key header", async () => {
    process.env["EXTENSION_API_KEY"] = "some-other-value";
    mockPrisma.session.findUnique.mockResolvedValue(validSession());
    mockPrisma.user.findUnique.mockResolvedValue(activeUser());

    const result = await validateExtensionAuth(request({ key: "old-build-key", bearer: "valid-token" }));

    expect(result).toMatchObject({ ok: true, teamIds: ["team-a"] });
  });

  it("does not let an extension key header stand in for a sync token", async () => {
    const result = await validateExtensionAuth(request({ key: "old-build-key" }));

    expect(result).toMatchObject({ ok: false, status: 401, code: "MISSING_TOKEN" });
    expect(mockPrisma.session.findUnique).not.toHaveBeenCalled();
  });

  it("rejects a request with no bearer token", async () => {
    const result = await validateExtensionAuth(request());
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.code).toBe("MISSING_TOKEN");
  });

  it("rejects a token with no matching Session row", async () => {
    mockPrisma.session.findUnique.mockResolvedValue(null);
    const result = await validateExtensionAuth(request({ bearer: "does-not-exist" }));
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.code).toBe("INVALID_TOKEN");
  });

  it("rejects an expired Session token", async () => {
    mockPrisma.session.findUnique.mockResolvedValue({
      userId: "user-1",
      expires: new Date(Date.now() - 1000),
    });
    const result = await validateExtensionAuth(request({ bearer: "expired-token" }));
    expect(result.ok).toBe(false);
    expect(mockPrisma.user.findUnique).not.toHaveBeenCalled();
  });

  it("accepts a valid, unexpired Session token and scopes teams to active memberships only", async () => {
    mockPrisma.session.findUnique.mockResolvedValue({
      userId: "user-1",
      expires: new Date(Date.now() + 60_000),
    });
    mockPrisma.user.findUnique.mockResolvedValue({
      id: "user-1",
      email: "u@example.com",
      name: "User",
      memberships: [{ teamId: "team-a" }],
    });

    const result = await validateExtensionAuth(request({ bearer: "valid-token" }));

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.teamIds).toEqual(["team-a"]);
      expect(result.user.id).toBe("user-1");
    }
    expect(mockPrisma.user.findUnique).toHaveBeenCalledWith({
      where: { id: "user-1" },
      select: {
        id: true,
        email: true,
        name: true,
        suspendedAt: true,
        memberships: { where: { status: "active" }, select: { teamId: true } },
      },
    });
  });

  describe("a sync token generated in a team", () => {
    const member = (teamIds: string[]) => ({
      id: "user-1",
      email: "u@example.com",
      name: "User",
      memberships: teamIds.map((teamId) => ({ teamId })),
    });

    it("acts only in that team, even when the user is in several", async () => {
      mockPrisma.session.findUnique.mockResolvedValue({ userId: "user-1", expires: new Date(Date.now() + 60_000), teamId: "team-b" });
      mockPrisma.user.findUnique.mockResolvedValue(member(["team-a", "team-b"]));

      const result = await validateExtensionAuth(request({ bearer: "valid-token" }));

      expect(result).toMatchObject({ ok: true, teamIds: ["team-b"] });
    });

    it("stops working once the user is no longer an active member of that team", async () => {
      mockPrisma.session.findUnique.mockResolvedValue({ userId: "user-1", expires: new Date(Date.now() + 60_000), teamId: "team-b" });
      mockPrisma.user.findUnique.mockResolvedValue(member(["team-a"]));

      const result = await validateExtensionAuth(request({ bearer: "valid-token" }));

      expect(result).toMatchObject({ ok: false, status: 403, code: "TOKEN_TEAM_REVOKED" });
    });

    it("keeps an older token with no team working across the user's teams", async () => {
      mockPrisma.session.findUnique.mockResolvedValue({ userId: "user-1", expires: new Date(Date.now() + 60_000), teamId: null });
      mockPrisma.user.findUnique.mockResolvedValue(member(["team-a", "team-b"]));

      const result = await validateExtensionAuth(request({ bearer: "valid-token" }));

      expect(result).toMatchObject({ ok: true, teamIds: ["team-a", "team-b"] });
    });
  });

  it("refuses a user suspended from the superadmin panel", async () => {
    mockPrisma.session.findUnique.mockResolvedValue({
      userId: "user-1",
      expires: new Date(Date.now() + 60_000),
    });
    mockPrisma.user.findUnique.mockResolvedValue({
      id: "user-1",
      email: "u@example.com",
      name: "User",
      suspendedAt: new Date(),
      memberships: [{ teamId: "team-a" }],
    });

    const result = await validateExtensionAuth(request({ bearer: "valid-token" }));

    expect(result).toMatchObject({ ok: false, status: 403, code: "ACCOUNT_SUSPENDED" });
  });
});
