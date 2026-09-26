import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const { mockPrisma, timingSafeEqualSpy } = vi.hoisted(() => ({
  mockPrisma: {
    user: {
      findUnique: vi.fn(),
    },
    session: {
      findUnique: vi.fn(),
    },
  },
  timingSafeEqualSpy: vi.fn(),
}));

vi.mock("@/lib/db", () => ({
  prisma: mockPrisma,
}));

// Wrap (not replace) timingSafeEqual so the real constant-time compare still runs,
// but the test can prove the extension key goes through it rather than `!==`.
vi.mock("crypto", async (importOriginal) => {
  const actual = await importOriginal<typeof import("crypto")>();
  timingSafeEqualSpy.mockImplementation(actual.timingSafeEqual);
  return { ...actual, default: { ...actual, timingSafeEqual: timingSafeEqualSpy }, timingSafeEqual: timingSafeEqualSpy };
});

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

  it("compares the extension key in constant time on equal-length buffers (S-11)", async () => {
    // "wrong" is shorter than ENV_KEY: a raw timingSafeEqual would throw on the
    // length mismatch, and `!==` would leak timing - the helper avoids both.
    const result = await validateExtensionAuth(request({ key: "wrong", bearer: "anything" }));

    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.code).toBe("INVALID_EXTENSION_KEY");
    expect(timingSafeEqualSpy).toHaveBeenCalledTimes(1);
    const [provided, required] = timingSafeEqualSpy.mock.calls[0] as [Buffer, Buffer];
    expect(provided.length).toBe(required.length);
  });

  it("rejects a same-length wrong key and a key that only extends the real one", async () => {
    const sameLength = "x".repeat(ENV_KEY.length);
    for (const key of [sameLength, `${ENV_KEY}x`]) {
      const result = await validateExtensionAuth(request({ key, bearer: "anything" }));
      expect(result.ok).toBe(false);
      if (!result.ok) expect(result.code).toBe("INVALID_EXTENSION_KEY");
    }
    expect(mockPrisma.session.findUnique).not.toHaveBeenCalled();
  });

  it("still rejects when EXTENSION_API_KEY is empty, even if an empty key header is sent", async () => {
    // An empty header equals an empty key, so the empty-key guard must run before the compare.
    process.env["EXTENSION_API_KEY"] = "";
    const result = await validateExtensionAuth(request({ key: "", bearer: "anything" }));

    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.code).toBe("MISSING_EXTENSION_KEY");
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
