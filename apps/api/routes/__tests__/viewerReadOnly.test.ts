import { beforeEach, describe, expect, it, vi } from "vitest";

// A VIEWER is meant to be read-only (see TeamRole in @/lib/permissions). Every mutating handler listed
// here is team-scoped but used to accept any member, so the role check has to come before the work.

const { dbCalls, mockPrisma, caller } = vi.hoisted(() => {
    const dbCalls: string[] = [];
    const caller = { role: "viewer" };
    const model = (name: string) =>
        new Proxy(
            {},
            {
                get: (_target, method: string) => (..._args: unknown[]) => {
                    dbCalls.push(`${name}.${method}`);
                    if (name === "teamMember") return Promise.resolve({ role: caller.role, teamId: "team-a" });
                    return Promise.resolve(null);
                },
            },
        );
    const mockPrisma = new Proxy({}, { get: (_target, name: string) => model(name) });
    return { dbCalls, mockPrisma, caller };
});

vi.mock("@/lib/db", () => ({ prisma: mockPrisma }));
vi.mock("@/lib/auth", () => ({
    getCurrentContext: vi.fn().mockResolvedValue({ userId: "user-viewer", teamId: "team-a" }),
    getCurrentContextFromRequest: vi.fn().mockResolvedValue({ userId: "user-viewer", teamId: "team-a" }),
}));

const WRITES = /\.(create|createMany|update|updateMany|upsert|delete|deleteMany)$/;

const json = (method: string, body: unknown = {}) =>
    new Request("http://localhost/x", { method, body: JSON.stringify(body) }) as any;
const idParams = { params: Promise.resolve({ id: "res-1" }) };

const cases: Array<{ name: string; load: () => Promise<any>; method: string; args: () => unknown[] }> = [
    { name: "POST /schedules", load: () => import("../schedules/route"), method: "POST", args: () => [json("POST", { name: "s", cron: "* * * * *" })] },
    { name: "PATCH /schedules/[id]", load: () => import("../schedules/[id]/route"), method: "PATCH", args: () => [json("PATCH", { isActive: false }), idParams] },
    { name: "DELETE /schedules/[id]", load: () => import("../schedules/[id]/route"), method: "DELETE", args: () => [json("DELETE"), idParams] },
    { name: "POST /knowledge", load: () => import("../knowledge/route"), method: "POST", args: () => [json("POST", { name: "kb" })] },
    { name: "POST /knowledge/[id]", load: () => import("../knowledge/[id]/route"), method: "POST", args: () => [json("POST", { type: "URL", url: "https://example.com" }), idParams] },
    { name: "DELETE /knowledge/[id]", load: () => import("../knowledge/[id]/route"), method: "DELETE", args: () => [json("DELETE"), idParams] },
    { name: "POST /templates", load: () => import("../templates/route"), method: "POST", args: () => [json("POST", { name: "n", subject: "s", body: "b" })] },
    { name: "PUT /templates/[id]", load: () => import("../templates/[id]/route"), method: "PUT", args: () => [json("PUT", { name: "n", subject: "s", body: "b" }), idParams] },
    { name: "DELETE /templates/[id]", load: () => import("../templates/[id]/route"), method: "DELETE", args: () => [json("DELETE"), idParams] },
    { name: "POST /jobs", load: () => import("../jobs/route"), method: "POST", args: () => [json("POST", { type: "lead_scoring", payload: {} })] },
    { name: "DELETE /jobs/[id]", load: () => import("../jobs/[id]/route"), method: "DELETE", args: () => [json("DELETE"), idParams] },
    { name: "POST /inbox/drafts", load: () => import("../inbox/drafts/route"), method: "POST", args: () => [json("POST", { leadId: "lead-1", content: "hi" })] },
    { name: "DELETE /inbox/drafts", load: () => import("../inbox/drafts/route"), method: "DELETE", args: () => [new Request("http://localhost/inbox/drafts?draftId=d-1", { method: "DELETE" }) as any] },
    { name: "POST /scoring/case-study", load: () => import("../scoring/case-study/route"), method: "POST", args: () => [json("POST", { title: "t" })] },
    { name: "DELETE /scoring/case-study", load: () => import("../scoring/case-study/route"), method: "DELETE", args: () => [json("DELETE", { caseStudyId: "cs-1" })] },
    { name: "POST /scoring/case-studies", load: () => import("../scoring/case-studies/route"), method: "POST", args: () => [json("POST", { title: "t", industry: "i", summary: "s", content: "c" })] },
    { name: "DELETE /scoring/case-studies", load: () => import("../scoring/case-studies/route"), method: "DELETE", args: () => [new Request("http://localhost/scoring/case-studies?id=cs-1", { method: "DELETE" }) as any] },
    { name: "POST /bulk/action", load: () => import("../bulk/action/route"), method: "POST", args: () => [json("POST", { action: "delete", type: "lead", ids: ["lead-1"] })] },
];

describe("mutating routes refuse a VIEWER", () => {
    beforeEach(() => {
        dbCalls.length = 0;
        caller.role = "viewer";
        vi.spyOn(console, "error").mockImplementation(() => {});
    });

    it.each(cases)("$name", async ({ load, method, args }) => {
        const mod = await load();

        const response = await mod[method](...args());

        expect(response.status).toBe(403);
        expect(dbCalls).toContain("teamMember.findFirst");
        expect(dbCalls.filter((call) => WRITES.test(call))).toEqual([]);
    });
});

describe("a MEMBER still gets past the role check", () => {
    beforeEach(() => {
        dbCalls.length = 0;
        caller.role = "member";
    });

    it("POST /bulk/action reaches its own validation", async () => {
        const { POST } = await import("../bulk/action/route");

        const response = await POST(json("POST", { action: "delete", type: "lead", ids: [] }));

        expect(response.status).toBe(200);
        expect(await response.json()).toMatchObject({ success: false, message: "No items selected" });
    });

    it("POST /bulk/action rejects more than 500 ids in one request", async () => {
        const { POST } = await import("../bulk/action/route");
        const ids = Array.from({ length: 501 }, (_, i) => `lead-${i}`);

        const response = await POST(json("POST", { action: "delete", type: "lead", ids }));

        expect(response.status).toBe(400);
        expect(dbCalls.filter((call) => WRITES.test(call))).toEqual([]);
    });
});
