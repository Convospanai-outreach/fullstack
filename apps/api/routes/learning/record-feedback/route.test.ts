import { beforeEach, describe, expect, it, vi } from "vitest";

const { mockGetCurrentContext, mockPrisma, mockRecord } = vi.hoisted(() => ({
    mockGetCurrentContext: vi.fn(),
    mockPrisma: { generation: { findFirst: vi.fn() } },
    mockRecord: vi.fn(),
}));

vi.mock("@/lib/auth", () => ({ getCurrentContext: mockGetCurrentContext }));
vi.mock("@/lib/db", () => ({ prisma: mockPrisma }));
vi.mock("@/modules/learning/EventStore", () => ({
    EventStore: { record: mockRecord },
    SystemEventType: { USER: "USER" },
}));

import { POST } from "./route";

function postRequest(body: unknown) {
    return new Request("http://localhost/learning/record-feedback", { method: "POST", body: JSON.stringify(body) }) as any;
}

describe("POST /learning/record-feedback", () => {
    beforeEach(() => {
        vi.clearAllMocks();
        mockGetCurrentContext.mockResolvedValue({ userId: "user-1", teamId: "team-1" });
        mockRecord.mockResolvedValue(undefined);
    });

    it("looks the generation up through the caller's team", async () => {
        mockPrisma.generation.findFirst.mockResolvedValue({ id: "gen-1" });

        const res = await POST(postRequest({ generationId: "gen-1", feedbackType: "thumbs_up" }));

        expect(res.status).toBe(200);
        expect(mockPrisma.generation.findFirst).toHaveBeenCalledWith({
            where: { id: "gen-1", lead: { teamId: "team-1" } },
        });
        expect(mockRecord).toHaveBeenCalledWith(expect.objectContaining({ teamId: "team-1", actorId: "user-1" }));
    });

    it("404s and records nothing for a generation that belongs to another team", async () => {
        mockPrisma.generation.findFirst.mockResolvedValue(null);

        const res = await POST(postRequest({ generationId: "gen-other-team", feedbackType: "thumbs_up" }));

        expect(res.status).toBe(404);
        expect(mockRecord).not.toHaveBeenCalled();
    });

    it("401s without a session", async () => {
        mockGetCurrentContext.mockResolvedValue({ userId: null, teamId: null });

        const res = await POST(postRequest({ generationId: "gen-1", feedbackType: "thumbs_up" }));

        expect(res.status).toBe(401);
        expect(mockPrisma.generation.findFirst).not.toHaveBeenCalled();
    });
});
