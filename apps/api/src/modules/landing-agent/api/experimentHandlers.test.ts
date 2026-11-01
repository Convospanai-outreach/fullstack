import { beforeEach, describe, expect, it, vi } from "vitest";

const { mockCtx, mockExp } = vi.hoisted(() => ({
    mockCtx: { getCurrentContextFromRequest: vi.fn() },
    mockExp: {
        createExperiment: vi.fn(),
        startExperiment: vi.fn(),
        pauseExperiment: vi.fn(),
        endExperiment: vi.fn(),
        pickWinner: vi.fn(),
        getExperimentResults: vi.fn(),
        listExperiments: vi.fn(),
    },
}));

vi.mock("@/lib/auth", () => ({ getCurrentContextFromRequest: mockCtx.getCurrentContextFromRequest }));
vi.mock("@/lib/permissions", () => ({ authorizeRole: vi.fn(), TeamRole: { MEMBER: "MEMBER", ADMIN: "ADMIN" } }));
vi.mock("../service", () => ({ landingAgentService: {} }));
vi.mock("../experimentService", () => mockExp);

import { getExperiment, getExperiments, postCreateExperiment, postExperimentAction } from "./handlers";

const SIGNED_IN = { userId: "user-1", teamId: "team-1" };

function jsonRequest(method: string, body?: unknown) {
    return new Request("http://localhost/landing-agent/experiments", {
        method,
        headers: { "content-type": "application/json" },
        body: body === undefined ? undefined : JSON.stringify(body),
    });
}

const ctx = (params: Record<string, string>) => ({ params: Promise.resolve(params) });

describe("experiment handlers", () => {
    beforeEach(() => {
        vi.clearAllMocks();
        mockCtx.getCurrentContextFromRequest.mockResolvedValue(SIGNED_IN);
    });

    it("creates a test for the signed-in team with the parsed body", async () => {
        mockExp.createExperiment.mockResolvedValue({ id: "exp-1" });
        const res = await postCreateExperiment(
            jsonRequest("POST", { name: "Hero", slug: "spring", pageAId: "page-a", pageBId: "page-b", weightA: 40 }),
        );

        expect(res.status).toBe(200);
        expect(mockExp.createExperiment).toHaveBeenCalledWith({
            teamId: "team-1",
            name: "Hero",
            slug: "spring",
            pageAId: "page-a",
            pageBId: "page-b",
            weightA: 40,
        });
    });

    it("rejects a body with a bad slug before reaching the service", async () => {
        const res = await postCreateExperiment(
            jsonRequest("POST", { name: "Hero", slug: "Bad Slug!", pageAId: "page-a", pageBId: "page-b", weightA: 40 }),
        );
        expect(res.status).toBe(400);
        expect(mockExp.createExperiment).not.toHaveBeenCalled();
    });

    it("returns 401 without a signed-in team", async () => {
        mockCtx.getCurrentContextFromRequest.mockResolvedValue({ userId: null, teamId: null });
        const res = await postCreateExperiment(
            jsonRequest("POST", { name: "Hero", slug: "spring", pageAId: "page-a", pageBId: "page-b", weightA: 40 }),
        );
        expect(res.status).toBe(401);
    });

    it("returns the results for the experiment in the signed-in team", async () => {
        mockExp.getExperimentResults.mockResolvedValue({ experimentId: "exp-1", verdict: { status: "not_enough_data" } });
        const res = await getExperiment(jsonRequest("GET"), ctx({ id: "exp-1" }));

        expect(res.status).toBe(200);
        expect(mockExp.getExperimentResults).toHaveBeenCalledWith(expect.objectContaining({ teamId: "team-1", experimentId: "exp-1" }));
    });

    it("runs start, pause and end on the experiment", async () => {
        mockExp.startExperiment.mockResolvedValue({ id: "exp-1", status: "running" });
        await postExperimentAction(jsonRequest("POST", {}), ctx({ id: "exp-1", action: "start" }));
        expect(mockExp.startExperiment).toHaveBeenCalledWith(expect.objectContaining({ teamId: "team-1", experimentId: "exp-1" }));

        mockExp.pauseExperiment.mockResolvedValue({ id: "exp-1", status: "paused" });
        await postExperimentAction(jsonRequest("POST", {}), ctx({ id: "exp-1", action: "pause" }));
        expect(mockExp.pauseExperiment).toHaveBeenCalledWith(expect.objectContaining({ teamId: "team-1", experimentId: "exp-1" }));

        mockExp.endExperiment.mockResolvedValue({ id: "exp-1", status: "ended" });
        await postExperimentAction(jsonRequest("POST", {}), ctx({ id: "exp-1", action: "end" }));
        expect(mockExp.endExperiment).toHaveBeenCalledWith(expect.objectContaining({ teamId: "team-1", experimentId: "exp-1" }));
    });

    it("picks a winner from the body's page id", async () => {
        mockExp.pickWinner.mockResolvedValue({ id: "exp-1", status: "ended" });
        const res = await postExperimentAction(jsonRequest("POST", { pageId: "page-b" }), ctx({ id: "exp-1", action: "winner" }));

        expect(res.status).toBe(200);
        expect(mockExp.pickWinner).toHaveBeenCalledWith(expect.objectContaining({ teamId: "team-1", experimentId: "exp-1", pageId: "page-b" }));
    });

    it("returns 404 for an unknown action", async () => {
        const res = await postExperimentAction(jsonRequest("POST", {}), ctx({ id: "exp-1", action: "delete" }));
        expect(res.status).toBe(404);
    });

    it("lists the team's experiments", async () => {
        mockExp.listExperiments.mockResolvedValue([{ id: "exp-1", name: "Hero", status: "draft" }]);
        const res = await getExperiments(jsonRequest("GET"));

        expect(res.status).toBe(200);
        expect(mockExp.listExperiments).toHaveBeenCalledWith({ teamId: "team-1" });
        expect(await res.json()).toMatchObject([{ id: "exp-1" }]);
    });
});
