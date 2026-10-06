import { beforeEach, describe, expect, it, vi } from "vitest";

const { validateAuth, checkPermission, chooseSequence } = vi.hoisted(() => ({
    validateAuth: vi.fn(),
    checkPermission: vi.fn(),
    chooseSequence: vi.fn(),
}));

vi.mock("../../../_lib/auth", () => ({ validateExtensionAuth: validateAuth }));
vi.mock("@/lib/permissions", () => ({ checkTeamPermission: checkPermission, TeamRole: { MEMBER: "MEMBER" } }));
vi.mock("@/services/extensionLeadCaptureService", () => ({ chooseSequenceForLead: chooseSequence }));

import { POST } from "./route";

const call = (body: unknown) =>
    POST(new Request("http://localhost/extension/leads/lead-1/sequence", { method: "POST", body: JSON.stringify(body) }) as any, {
        params: Promise.resolve({ id: "lead-1" }),
    });

describe("extension: add a lead to a sequence", () => {
    beforeEach(() => {
        vi.clearAllMocks();
        validateAuth.mockResolvedValue({ ok: true, user: { id: "user-1" }, teamIds: ["team-a"] });
        checkPermission.mockResolvedValue(true);
        chooseSequence.mockResolvedValue({ success: true, status: "ENROLLED" });
    });

    it("adds the lead in the caller's team", async () => {
        const res = await call({ sequenceId: "seq-1" });
        expect(res.status).toBe(200);
        expect(chooseSequence).toHaveBeenCalledWith({ teamId: "team-a", userId: "user-1", leadId: "lead-1", sequenceId: "seq-1" });
        expect(checkPermission).toHaveBeenCalledWith("user-1", "team-a", "MEMBER");
    });

    it("refuses a viewer, a missing sequence and a team the caller isn't in", async () => {
        checkPermission.mockResolvedValueOnce(false);
        expect((await call({ sequenceId: "seq-1" })).status).toBe(403);
        expect((await call({})).status).toBe(400);
        expect((await call({ sequenceId: "seq-1", teamId: "team-b" })).status).toBe(403);
        expect(chooseSequence).not.toHaveBeenCalled();
    });

    it("maps a lead or sequence that isn't found", async () => {
        chooseSequence.mockRejectedValueOnce(new Error("Lead not found"));
        expect((await call({ sequenceId: "seq-1" })).status).toBe(404);
        chooseSequence.mockRejectedValueOnce(new Error("Sequence not available"));
        expect((await call({ sequenceId: "seq-1" })).status).toBe(400);
    });

    it("rejects a request without extension auth", async () => {
        validateAuth.mockResolvedValueOnce({ ok: false, status: 401, code: "INVALID_TOKEN", error: "Invalid authorization token" });
        expect((await call({ sequenceId: "seq-1" })).status).toBe(401);
    });
});
