import { beforeEach, describe, expect, it, vi } from "vitest";

const m = vi.hoisted(() => ({
    getCurrentContext: vi.fn(),
    authorizeRole: vi.fn(),
    findFirst: vi.fn(),
    requestPlacementCheck: vi.fn(),
}));

vi.mock("@/lib/auth", () => ({ getCurrentContext: m.getCurrentContext }));
vi.mock("@/lib/permissions", () => ({
    TeamRole: { OWNER: "owner", ADMIN: "admin", MEMBER: "member", VIEWER: "viewer" },
    authorizeRole: m.authorizeRole,
}));
vi.mock("@/lib/db", () => ({ prisma: { connectedMailbox: { findFirst: m.findFirst }, $executeRaw: vi.fn() } }));
const audit = vi.hoisted(() => vi.fn());
vi.mock("@/lib/governance/audit", () => ({ audit }));
vi.mock("@/modules/email-campaigner/service/inboxPlacementCheck", async () => {
    const actual = await vi.importActual<typeof import("@/modules/email-campaigner/service/inboxPlacementCheck")>("@/modules/email-campaigner/service/inboxPlacementCheck");
    return { ...actual, requestPlacementCheck: m.requestPlacementCheck };
});

import { PlacementError } from "@/modules/email-campaigner/service/inboxPlacementCheck";
import { GET, PATCH, POST } from "./route";

const params = { params: Promise.resolve({ id: "m1" }) };
const done = {
    runId: "r", status: "done", requestedBy: "u1", startedAt: new Date().toISOString(), checkedAt: new Date().toISOString(),
    campaignId: null, stepId: null, contentSource: "sample", sentTo: ["seed@gmail.com"], error: null, verdict: { level: "red", reasons: [] },
    results: [{ inbox: "seed@gmail.com", provider: "gmail", folder: "spam", auth: null }],
};

beforeEach(() => {
    vi.clearAllMocks();
    m.getCurrentContext.mockResolvedValue({ userId: "u1", teamId: "t1" });
    m.authorizeRole.mockResolvedValue(undefined);
});

describe("GET /mailboxes/[id]/placement-check", () => {
    it("returns the verdict without the operator's test addresses", async () => {
        m.findFirst.mockResolvedValue({ metadata: { placement: done } });
        const res = await GET(new Request("http://x"), params);
        const body = await res.json();
        expect(res.status).toBe(200);
        expect(body.verdict.level).toBe("red");
        expect(body.state.sent).toBe(1);
        expect(JSON.stringify(body)).not.toContain("seed@gmail.com");
        expect(m.findFirst).toHaveBeenCalledWith(expect.objectContaining({ where: { id: "m1", teamId: "t1" } }));
    });

    it("shows a check that went quiet for 15 minutes as failed instead of running forever", async () => {
        const startedAt = new Date(Date.now() - 20 * 60_000).toISOString();
        m.findFirst.mockResolvedValue({ metadata: { placement: { ...done, status: "running", checkedAt: null, startedAt } } });
        const body = await (await GET(new Request("http://x"), params)).json();
        expect(body.state.status).toBe("failed");
        expect(body.state.error).toMatch(/did not finish/);
    });

    it("is amber when the mailbox was never checked", async () => {
        m.findFirst.mockResolvedValue({ metadata: null });
        expect((await (await GET(new Request("http://x"), params)).json()).verdict.level).toBe("amber");
    });
});

describe("POST /mailboxes/[id]/placement-check", () => {
    it("requires an admin and starts a check", async () => {
        m.requestPlacementCheck.mockResolvedValue({ ...done, status: "queued", results: [], sentTo: null, checkedAt: null });
        const res = await POST(new Request("http://x", { method: "POST", body: JSON.stringify({ campaignId: "c1" }) }), params);
        expect(res.status).toBe(202);
        expect(m.authorizeRole).toHaveBeenCalledWith("u1", "t1", "admin");
        expect(m.requestPlacementCheck).toHaveBeenCalledWith({ teamId: "t1", mailboxId: "m1", userId: "u1", campaignId: "c1" });
    });

    it("maps check errors to status codes, and rejects unknown body fields", async () => {
        m.requestPlacementCheck.mockRejectedValueOnce(new PlacementError("RATE_LIMITED", "later"));
        expect((await POST(new Request("http://x", { method: "POST", body: "{}" }), params)).status).toBe(429);
        const bad = await POST(new Request("http://x", { method: "POST", body: JSON.stringify({ to: "x@y.z" }) }), params);
        expect(bad.status).toBe(400);
    });
});

describe("PATCH /mailboxes/[id]/placement-check", () => {
    it("lets an admin accept a fresh red result, which then reads amber", async () => {
        m.findFirst.mockResolvedValue({ metadata: { placement: done } });
        const res = await PATCH(new Request("http://x", { method: "PATCH", body: JSON.stringify({ accept: true }) }), params);
        const body = await res.json();
        expect(res.status).toBe(200);
        expect(m.authorizeRole).toHaveBeenCalledWith("u1", "t1", "admin");
        expect(body.verdict.level).toBe("amber");
        expect(body.state.acceptedAt).toEqual(expect.any(String));
        expect(audit).toHaveBeenCalledWith(expect.objectContaining({ actorId: "u1", orgId: "t1", action: "PLACEMENT_RESULT_ACCEPTED", entityId: "m1" }));
    });

    it("refuses when there is no red result to accept", async () => {
        m.findFirst.mockResolvedValue({ metadata: null });
        expect((await PATCH(new Request("http://x", { method: "PATCH", body: JSON.stringify({ accept: true }) }), params)).status).toBe(409);
    });
});
