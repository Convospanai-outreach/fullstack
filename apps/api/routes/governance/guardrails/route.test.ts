import { beforeEach, describe, expect, it, vi } from "vitest";

const { mockCheckTeamPermission, mockGetCurrentContext, mockPrisma } = vi.hoisted(() => ({
    mockCheckTeamPermission: vi.fn(),
    mockGetCurrentContext: vi.fn(),
    mockPrisma: {
        guardrailPolicy: { upsert: vi.fn() },
    },
}));

vi.mock("@/lib/auth", () => ({ getCurrentContext: mockGetCurrentContext }));
vi.mock("@/lib/db", () => ({ prisma: mockPrisma }));
vi.mock("@/lib/logger", () => ({ logger: { error: vi.fn() } }));
vi.mock("@/lib/permissions", () => ({
    TeamRole: { ADMIN: "admin" },
    checkTeamPermission: mockCheckTeamPermission,
}));

import { POST } from "./route";

function jsonRequest(body: any) {
    return new Request("http://localhost", { method: "POST", body: JSON.stringify(body) }) as any;
}

describe("POST /governance/guardrails - field allowlisting", () => {
    beforeEach(() => {
        vi.clearAllMocks();
        mockGetCurrentContext.mockResolvedValue({ userId: "user-1", teamId: "team-1" });
        mockCheckTeamPermission.mockResolvedValue(true);
        mockPrisma.guardrailPolicy.upsert.mockResolvedValue({ id: "policy-1", teamId: "team-1" });
    });

    it("strips a caller-supplied teamId from the update payload", async () => {
        await POST(jsonRequest({ teamId: "team-victim", detectPII: false, strictness: "low" }));

        expect(mockPrisma.guardrailPolicy.upsert).toHaveBeenCalledWith({
            where: { teamId: "team-1" },
            create: { teamId: "team-1", detectPII: false, strictness: "low" },
            update: { detectPII: false, strictness: "low" },
        });
    });

    it("strips a caller-supplied id from the update payload", async () => {
        await POST(jsonRequest({ id: "some-other-policy-id", blocklist: ["spam"] }));

        expect(mockPrisma.guardrailPolicy.upsert).toHaveBeenCalledWith({
            where: { teamId: "team-1" },
            create: { teamId: "team-1", blocklist: ["spam"] },
            update: { blocklist: ["spam"] },
        });
    });

    it("passes through only the known-safe fields", async () => {
        await POST(jsonRequest({
            blocklist: ["spam"],
            allowlist: ["example.com"],
            regexRules: [],
            competitorMentions: ["Acme"],
            maxDailyMsgs: 50,
            detectPII: true,
            strictness: "high",
        }));

        expect(mockPrisma.guardrailPolicy.upsert).toHaveBeenCalledWith({
            where: { teamId: "team-1" },
            create: {
                teamId: "team-1",
                blocklist: ["spam"],
                allowlist: ["example.com"],
                regexRules: [],
                competitorMentions: ["Acme"],
                maxDailyMsgs: 50,
                detectPII: true,
                strictness: "high",
            },
            update: {
                blocklist: ["spam"],
                allowlist: ["example.com"],
                regexRules: [],
                competitorMentions: ["Acme"],
                maxDailyMsgs: 50,
                detectPII: true,
                strictness: "high",
            },
        });
    });
});
