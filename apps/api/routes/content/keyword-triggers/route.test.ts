import { describe, expect, it, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

// Characterization: the trigger routes already accept an optional flowId (keywordTriggerService
// schemas) and pass it to the service. The service's own checks (team-scoped flow, link step
// needs a landing page) are covered in keywordTriggerService.test.ts.
const svc = vi.hoisted(() => ({ createTrigger: vi.fn(), updateTrigger: vi.fn(), listTriggers: vi.fn(), deleteTrigger: vi.fn() }));

vi.mock("@/lib/db", () => ({ prisma: {} }));
vi.mock("@/lib/auth", () => ({ getCurrentContextFromRequest: vi.fn() }));
vi.mock("@/lib/permissions", () => ({ checkTeamPermission: vi.fn(), TeamRole: { ADMIN: "admin", MEMBER: "member" } }));
vi.mock("@/modules/creator-funnel/featureGate", () => ({ isCreatorFunnelEnabled: vi.fn() }));
vi.mock("@/modules/creator-funnel/keywordTriggerService", async (importOriginal) => ({ ...(await importOriginal<object>()), ...svc }));

import { POST } from "./route";
import { PATCH } from "./[id]/route";
import { getCurrentContextFromRequest } from "@/lib/auth";
import { checkTeamPermission } from "@/lib/permissions";
import { isCreatorFunnelEnabled } from "@/modules/creator-funnel/featureGate";

const BASE = "http://localhost:3001/content/keyword-triggers";
const json = (url: string, method: string, body: unknown) =>
    new NextRequest(url, { method, body: JSON.stringify(body), headers: { "content-type": "application/json" } });
const params = (id = "trig-1") => ({ params: Promise.resolve({ id }) });

const create = {
    socialAccountId: "acc-ig",
    keywords: ["guide"],
    replyText: "Here's the guide",
};

describe("/content/keyword-triggers flowId", () => {
    beforeEach(() => {
        vi.clearAllMocks();
        (getCurrentContextFromRequest as any).mockResolvedValue({ userId: "user-1", teamId: "team-a" });
        (checkTeamPermission as any).mockResolvedValue(true);
        (isCreatorFunnelEnabled as any).mockResolvedValue(true);
        svc.createTrigger.mockResolvedValue({ id: "trig-1" });
        svc.updateTrigger.mockResolvedValue({ id: "trig-1" });
    });

    it("passes an attached flowId on create, and defaults it to null when omitted", async () => {
        expect((await POST(json(BASE, "POST", { ...create, flowId: "flow-1" }))).status).toBe(201);
        expect(svc.createTrigger.mock.calls[0][2].flowId).toBe("flow-1");

        expect((await POST(json(BASE, "POST", create))).status).toBe(201);
        expect(svc.createTrigger.mock.calls[1][2].flowId).toBeNull();
    });

    it("passes a flowId change or a detach (null) on update", async () => {
        expect((await PATCH(json(`${BASE}/trig-1`, "PATCH", { flowId: "flow-2" }), params())).status).toBe(200);
        expect(svc.updateTrigger).toHaveBeenLastCalledWith("team-a", "user-1", "trig-1", { flowId: "flow-2" });

        expect((await PATCH(json(`${BASE}/trig-1`, "PATCH", { flowId: null }), params())).status).toBe(200);
        expect(svc.updateTrigger).toHaveBeenLastCalledWith("team-a", "user-1", "trig-1", { flowId: null });
    });

    it("rejects a flowId that is not a short string, before the service runs", async () => {
        expect((await POST(json(BASE, "POST", { ...create, flowId: 42 }))).status).toBe(400);
        expect((await PATCH(json(`${BASE}/trig-1`, "PATCH", { flowId: "x".repeat(65) }), params())).status).toBe(400);
        expect(svc.createTrigger).not.toHaveBeenCalled();
        expect(svc.updateTrigger).not.toHaveBeenCalled();
    });
});
