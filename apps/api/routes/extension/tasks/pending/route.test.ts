import { beforeEach, describe, expect, it, vi } from "vitest";

const mockValidateExtensionAuth = vi.fn();
const mockJobFindMany = vi.fn();
const mockJobUpdateMany = vi.fn();

vi.mock("../../_lib/auth", () => ({
    validateExtensionAuth: mockValidateExtensionAuth
}));

vi.mock("@/lib/db", () => ({
    prisma: {
        job: {
            findMany: mockJobFindMany,
            updateMany: mockJobUpdateMany
        }
    }
}));

function authAs(teamIds: string[]) {
    mockValidateExtensionAuth.mockResolvedValue({
        ok: true,
        user: { id: "user-1", email: "u@example.com", name: "User", memberships: teamIds.map((teamId) => ({ teamId })) },
        teamIds
    });
}

function makeReq(headers: Record<string, string> = {}) {
    return new Request("http://localhost/api/extension/tasks/pending", { method: "GET", headers }) as any;
}

describe("extension tasks/pending route", () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it("rejects an unauthenticated request", async () => {
        mockValidateExtensionAuth.mockResolvedValue({ ok: false, error: "Missing token", code: "NO_TOKEN", status: 401 });
        const { GET } = await import("./route");
        const res = await GET(makeReq());
        expect(res.status).toBe(401);
        expect(mockJobFindMany).not.toHaveBeenCalled();
    });

    it("claims pending supported-type jobs for the caller's team and returns them", async () => {
        authAs(["team-a"]);
        mockJobFindMany.mockResolvedValue([
            { id: "job-1", type: "OPEN_PROFILE", taskType: null, payload: { profileUrl: "https://www.linkedin.com/in/x/" } },
            { id: "job-2", type: "generic", taskType: "INSERT_DRAFT", payload: { body: "hi" } }
        ]);
        mockJobUpdateMany.mockResolvedValue({ count: 1 });

        const { GET } = await import("./route");
        const res = await GET(makeReq());
        const body = await res.json();

        expect(res.status).toBe(200);
        expect(body.ok).toBe(true);
        // Only jobs in the extension status lane of a supported type are queried, scoped to the team.
        const where = mockJobFindMany.mock.calls[0][0].where;
        expect(where.teamId).toBe("team-a");
        expect(where.status).toBe("awaiting_extension");
        // Each candidate is atomically claimed (status -> processing) before being returned.
        expect(mockJobUpdateMany).toHaveBeenCalledTimes(2);
        expect(body.tasks).toEqual([
            { id: "job-1", type: "OPEN_PROFILE", payload: { profileUrl: "https://www.linkedin.com/in/x/" } },
            { id: "job-2", type: "INSERT_DRAFT", payload: { body: "hi" } }
        ]);
    });

    it("does not return a candidate that another worker claimed first (updateMany count 0)", async () => {
        authAs(["team-a"]);
        mockJobFindMany.mockResolvedValue([{ id: "job-1", type: "OPEN_PROFILE", taskType: null, payload: {} }]);
        mockJobUpdateMany.mockResolvedValue({ count: 0 });

        const { GET } = await import("./route");
        const res = await GET(makeReq());
        const body = await res.json();

        expect(body.tasks).toEqual([]);
    });

    it("requires an explicit x-team-id for a multi-team user", async () => {
        authAs(["team-a", "team-b"]);
        const { GET } = await import("./route");
        const res = await GET(makeReq());
        expect(res.status).toBe(400);
        expect(mockJobFindMany).not.toHaveBeenCalled();
    });
});
