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

const ENV_KEY = "test-extension-key";

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
    process.env["EXTENSION_API_KEY"] = ENV_KEY;
    delete process.env["EXTENSION_ALLOW_LEGACY_IDENTITY_FALLBACKS"];
  });

  afterEach(() => {
    if (originalKey === undefined) delete process.env["EXTENSION_API_KEY"];
    else process.env["EXTENSION_API_KEY"] = originalKey;
    if (originalFallback === undefined) delete process.env["EXTENSION_ALLOW_LEGACY_IDENTITY_FALLBACKS"];
    else process.env["EXTENSION_ALLOW_LEGACY_IDENTITY_FALLBACKS"] = originalFallback;
  });

  it("rejects a missing or wrong extension key before ever checking the token", async () => {
    const result = await validateExtensionAuth(request({ key: "wrong", bearer: "anything" }));
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.code).toBe("INVALID_EXTENSION_KEY");
    expect(mockPrisma.session.findUnique).not.toHaveBeenCalled();
  });

  it("rejects a request with no bearer token", async () => {
    const result = await validateExtensionAuth(request({ key: ENV_KEY }));
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.code).toBe("MISSING_TOKEN");
  });

  it("rejects a token with no matching Session row", async () => {
    mockPrisma.session.findUnique.mockResolvedValue(null);
    const result = await validateExtensionAuth(request({ key: ENV_KEY, bearer: "does-not-exist" }));
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.code).toBe("INVALID_TOKEN");
  });

  it("rejects an expired Session token", async () => {
    mockPrisma.session.findUnique.mockResolvedValue({
      userId: "user-1",
      expires: new Date(Date.now() - 1000),
    });
    const result = await validateExtensionAuth(request({ key: ENV_KEY, bearer: "expired-token" }));
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

    const result = await validateExtensionAuth(request({ key: ENV_KEY, bearer: "valid-token" }));

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
        memberships: { where: { status: "active" }, select: { teamId: true } },
      },
    });
  });
});
