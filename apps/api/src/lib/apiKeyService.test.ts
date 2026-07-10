import { beforeEach, describe, expect, it, vi } from "vitest";

const { mockPrisma } = vi.hoisted(() => ({
  mockPrisma: {
    apiKey: {
      count: vi.fn(),
      create: vi.fn(),
      findMany: vi.fn(),
      updateMany: vi.fn(),
      findFirst: vi.fn(),
    },
  },
}));

vi.mock("@/lib/db", () => ({
  prisma: mockPrisma,
}));

import {
  createTeamApiKey,
  listTeamApiKeys,
  revokeTeamApiKey,
} from "./apiKeyService";
import { ApiKeyLimitError } from "./apiKeySecurity";

describe("api key persistence service", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns a raw secret once while persisting only a safe lookup record", async () => {
    mockPrisma.apiKey.count.mockResolvedValue(0);
    mockPrisma.apiKey.create.mockImplementation(async ({ data }: { data: Record<string, unknown> }) => ({
      id: "key-1",
      name: data.name,
      key: data.key,
      scopes: data.scopes,
      lastUsedAt: null,
      isActive: true,
      createdAt: new Date("2026-07-10T00:00:00.000Z"),
    }));

    const result = await createTeamApiKey("team-a", "CRM", ["leads:read"]);

    expect(result.secret).toMatch(/^cmf_live_/);
    expect(mockPrisma.apiKey.create).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({
        teamId: "team-a",
        key: expect.stringMatching(/^v2:[a-f0-9]{64}:[a-f0-9]{4}$/),
      }),
    }));
    const storedKey = mockPrisma.apiKey.create.mock.calls[0][0].data.key as string;
    expect(storedKey.includes(result.secret)).toBe(false);
    expect("key" in result.apiKey).toBe(false);
  });

  it("returns list metadata without raw or lookup material", async () => {
    mockPrisma.apiKey.findMany.mockResolvedValue([
      {
        id: "key-1",
        name: "CRM",
        key: "v2:" + "a".repeat(64) + ":cdef",
        scopes: ["leads:read"],
        lastUsedAt: null,
        isActive: true,
        createdAt: new Date("2026-07-10T00:00:00.000Z"),
      },
    ]);
    mockPrisma.apiKey.count.mockResolvedValue(1);

    const result = await listTeamApiKeys("team-a", 20, 0);

    expect(result.keys).toEqual([
      expect.objectContaining({
        id: "key-1",
        keyPrefix: "cmf_live_",
        keyLastFour: "cdef",
      }),
    ]);
    expect(JSON.stringify(result.keys)).not.toContain("v2:");
    expect(mockPrisma.apiKey.findMany).toHaveBeenCalledWith(expect.objectContaining({
      where: { teamId: "team-a" },
      take: 20,
      skip: 0,
    }));
  });

  it("caps active keys per team", async () => {
    mockPrisma.apiKey.count.mockResolvedValue(20);

    await expect(createTeamApiKey("team-a", "CRM", ["leads:read"]))
      .rejects.toBeInstanceOf(ApiKeyLimitError);
    expect(mockPrisma.apiKey.create).not.toHaveBeenCalled();
  });

  it("revokes by both key id and trusted team scope", async () => {
    mockPrisma.apiKey.updateMany.mockResolvedValue({ count: 0 });
    mockPrisma.apiKey.findFirst.mockResolvedValue(null);

    const result = await revokeTeamApiKey("team-a", "team-b-key");

    expect(result).toEqual({ found: false, revoked: false, alreadyRevoked: false });
    expect(mockPrisma.apiKey.updateMany).toHaveBeenCalledWith({
      where: { id: "team-b-key", teamId: "team-a", isActive: true },
      data: { isActive: false },
    });
  });

  it("treats repeat revocation as idempotent without deleting the record", async () => {
    mockPrisma.apiKey.updateMany.mockResolvedValue({ count: 0 });
    mockPrisma.apiKey.findFirst.mockResolvedValue({ id: "key-1", isActive: false });

    await expect(revokeTeamApiKey("team-a", "key-1")).resolves.toEqual({
      found: true,
      revoked: false,
      alreadyRevoked: true,
    });
  });
});
