import { beforeEach, describe, expect, it, vi } from "vitest";
import { GET, POST } from "./route";

const { permission, act, get, context } = vi.hoisted(() => ({
    permission: vi.fn(), act: vi.fn(), get: vi.fn(), context: vi.fn(),
}));
vi.mock("@/lib/auth", () => ({ getCurrentContextFromRequest: context }));
vi.mock("@/lib/permissions", () => ({
    TeamRole: { VIEWER: "viewer", ADMIN: "admin" }, checkTeamPermission: permission,
}));
vi.mock("@/modules/overseer/mailboxReputationActions", () => ({
    actOnMailboxReputation: act, getMailboxReputation: get,
}));

const params = { params: Promise.resolve({ mailboxId: "sender" }) };
const request = (body?: object) => new Request("https://app.example.test/settings/mailbox-reputation/sender", body ? {
    method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body),
} : undefined) as Parameters<typeof GET>[0];

describe("mailbox reputation settings access", () => {
    beforeEach(() => {
        vi.clearAllMocks();
        context.mockResolvedValue({ userId: "rep", teamId: "team" });
        get.mockResolvedValue({ mailbox: { id: "sender" }, guardEnabled: true });
        act.mockResolvedValue({ mailbox: { id: "sender" } });
    });

    it("lets a member view reputation but denies corrective actions", async () => {
        permission.mockImplementation(async (_user, _team, role) => role === "viewer");
        expect(await (await GET(request(), params)).json()).toEqual({ mailbox: { id: "sender" }, guardEnabled: true, canEdit: false });
        expect((await POST(request({ action: "resume" }), params)).status).toBe(403);
        expect(act).not.toHaveBeenCalled();
    });

    it("shows the disabled guard as read-only even to admins", async () => {
        permission.mockResolvedValue(true);
        get.mockResolvedValue({ mailbox: { id: "sender" }, guardEnabled: false });
        expect(await (await GET(request(), params)).json()).toMatchObject({ guardEnabled: false, canEdit: false });
    });

    it("scopes an authorized change to the session team and actor", async () => {
        permission.mockResolvedValue(true);
        expect((await POST(request({ action: "switch", replacementId: "other" }), params)).status).toBe(200);
        expect(act).toHaveBeenCalledWith("team", "sender", "rep", { action: "switch", replacementId: "other" });
    });
});
