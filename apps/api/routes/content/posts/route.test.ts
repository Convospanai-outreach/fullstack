import { describe, expect, it, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

const service = vi.hoisted(() => ({
    listPosts: vi.fn(),
    createPost: vi.fn(),
    updatePost: vi.fn(),
    submitPost: vi.fn(),
    getStageMix: vi.fn(),
    setStageMix: vi.fn(),
}));

vi.mock("@/lib/db", () => ({ prisma: {} }));
vi.mock("@/lib/auth", () => ({ getCurrentContextFromRequest: vi.fn() }));
vi.mock("@/lib/permissions", () => ({ checkTeamPermission: vi.fn(), TeamRole: { ADMIN: "admin" } }));
vi.mock("@/modules/creator-funnel/featureGate", () => ({ isCreatorFunnelEnabled: vi.fn() }));
vi.mock("@/modules/creator-funnel/contentPostService", async (importOriginal) => ({
    ...(await importOriginal<typeof import("@/modules/creator-funnel/contentPostService")>()),
    ...service,
}));

import { GET, POST } from "./route";
import { PATCH } from "./[id]/route";
import { POST as SUBMIT } from "./[id]/submit/route";
import { PUT as PUT_MIX } from "../stage-mix/route";
import { getCurrentContextFromRequest } from "@/lib/auth";
import { checkTeamPermission } from "@/lib/permissions";
import { isCreatorFunnelEnabled } from "@/modules/creator-funnel/featureGate";
import { ContentPostError } from "@/modules/creator-funnel/contentPostService";

const BASE = "http://localhost:3001/content";
const json = (url: string, method: string, body: unknown) =>
    new NextRequest(url, { method, body: JSON.stringify(body), headers: { "content-type": "application/json" } });
const params = (id = "post-1") => ({ params: Promise.resolve({ id }) });

describe("/content routes", () => {
    beforeEach(() => {
        vi.clearAllMocks();
        (getCurrentContextFromRequest as any).mockResolvedValue({ userId: "user-1", teamId: "team-a" });
        (checkTeamPermission as any).mockResolvedValue(true);
        (isCreatorFunnelEnabled as any).mockResolvedValue(true);
        service.listPosts.mockResolvedValue({ posts: [], unscheduled: [] });
        service.createPost.mockResolvedValue({ id: "post-1" });
        service.updatePost.mockResolvedValue({ id: "post-1" });
    });

    it("401s without a team and 404s when the creator funnel is off", async () => {
        (getCurrentContextFromRequest as any).mockResolvedValueOnce({ userId: null, teamId: null });
        expect((await GET(new NextRequest(`${BASE}/posts`))).status).toBe(401);

        (isCreatorFunnelEnabled as any).mockResolvedValue(false);
        expect((await POST(json(`${BASE}/posts`, "POST", { funnelStage: "TOFU" }))).status).toBe(404);
        expect((await SUBMIT(new NextRequest(`${BASE}/posts/post-1/submit`, { method: "POST" }), params())).status).toBe(404);
        expect(service.createPost).not.toHaveBeenCalled();
        expect(service.submitPost).not.toHaveBeenCalled();
    });

    it("lists a bounded range", async () => {
        const ok = await GET(new NextRequest(`${BASE}/posts?from=2026-10-01T00:00:00Z&to=2026-11-01T00:00:00Z&stage=MOFU`));
        expect(ok.status).toBe(200);
        expect(service.listPosts).toHaveBeenCalledWith("team-a", expect.objectContaining({ stage: "MOFU", from: new Date("2026-10-01T00:00:00Z") }));

        expect((await GET(new NextRequest(`${BASE}/posts?from=2026-10-01T00:00:00Z&to=2027-01-01T00:00:00Z`))).status).toBe(400);
        expect((await GET(new NextRequest(`${BASE}/posts?from=nope&to=2026-11-01T00:00:00Z`))).status).toBe(400);
    });

    it("validates new posts and passes dates through as Dates", async () => {
        expect((await POST(json(`${BASE}/posts`, "POST", { funnelStage: "LATER" }))).status).toBe(400);
        expect((await POST(json(`${BASE}/posts`, "POST", { funnelStage: "TOFU", timezone: "Mars/Olympus" }))).status).toBe(400);

        const res = await POST(json(`${BASE}/posts`, "POST", { funnelStage: "TOFU", body: "Hi", scheduledAt: "2030-01-07T10:00:00+05:30", timezone: "Asia/Kolkata" }));
        expect(res.status).toBe(201);
        expect(service.createPost).toHaveBeenCalledWith("team-a", "user-1", {
            body: "Hi", funnelStage: "TOFU", mediaUrls: [], accountIds: [], timezone: "Asia/Kolkata", scheduledAt: new Date("2030-01-07T04:30:00Z"),
        });
    });

    it("only passes the fields a PATCH sent", async () => {
        await PATCH(json(`${BASE}/posts/post-1`, "PATCH", { scheduledAt: null }), params());
        expect(service.updatePost).toHaveBeenCalledWith("team-a", "post-1", { scheduledAt: null });
        await PATCH(json(`${BASE}/posts/post-1`, "PATCH", { body: "x" }), params());
        expect(service.updatePost).toHaveBeenLastCalledWith("team-a", "post-1", { body: "x" });
    });

    it("maps the service's errors to their status", async () => {
        service.submitPost.mockRejectedValue(new ContentPostError(400, "Pick a time first."));
        const res = await SUBMIT(new NextRequest(`${BASE}/posts/post-1/submit`, { method: "POST" }), params());
        expect(res.status).toBe(400);
        expect(await res.json()).toEqual({ error: "Pick a time first." });
    });

    it("lets only admins set a stage mix that adds up to 100", async () => {
        expect((await PUT_MIX(json(`${BASE}/stage-mix`, "PUT", { TOFU: 60, MOFU: 30, BOFU: 10, POST: 10 }))).status).toBe(400);
        expect(service.setStageMix).not.toHaveBeenCalled();

        service.setStageMix.mockImplementation(async (_team: string, mix: unknown) => mix);
        const ok = await PUT_MIX(json(`${BASE}/stage-mix`, "PUT", { TOFU: 50, MOFU: 30, BOFU: 15, POST: 5 }));
        expect(await ok.json()).toEqual({ target: { TOFU: 50, MOFU: 30, BOFU: 15, POST: 5 } });

        (checkTeamPermission as any).mockResolvedValue(false);
        expect((await PUT_MIX(json(`${BASE}/stage-mix`, "PUT", { TOFU: 50, MOFU: 30, BOFU: 15, POST: 5 }))).status).toBe(403);
    });
});
