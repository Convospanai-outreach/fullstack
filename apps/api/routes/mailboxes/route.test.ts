import { beforeEach, describe, expect, it, vi } from "vitest";

const { mockGetCurrentContext, mockCheckTeamPermission, mockPrisma, mockBuildGoogleMailboxAuthUrl, mockUpdateMailboxControls, mockListConnectedMailboxes } = vi.hoisted(() => ({
    mockGetCurrentContext: vi.fn(),
    mockCheckTeamPermission: vi.fn(),
    mockPrisma: {
        connectedMailbox: { deleteMany: vi.fn() },
    },
    mockBuildGoogleMailboxAuthUrl: vi.fn(),
    mockUpdateMailboxControls: vi.fn(),
    mockListConnectedMailboxes: vi.fn(),
}));

vi.mock("@/lib/auth", () => ({ getCurrentContext: mockGetCurrentContext }));
vi.mock("@/lib/db", () => ({ prisma: mockPrisma }));
vi.mock("@/lib/permissions", () => ({
    checkTeamPermission: mockCheckTeamPermission,
    TeamRole: { OWNER: "OWNER", ADMIN: "ADMIN", MEMBER: "MEMBER", VIEWER: "VIEWER" },
}));
vi.mock("@/modules/email-campaigner/service/googleMailboxService", () => ({
    buildGoogleMailboxAuthUrl: mockBuildGoogleMailboxAuthUrl,
    connectGoogleMailbox: vi.fn(),
    listConnectedMailboxes: mockListConnectedMailboxes,
    updateMailboxControls: mockUpdateMailboxControls,
}));

import { DELETE, PATCH, POST } from "./route";

function jsonRequest(body: unknown) {
    return new Request("http://localhost/mailboxes", { method: "POST", body: JSON.stringify(body) }) as any;
}

describe("/mailboxes - integration mutations require ADMIN (OPEN-211)", () => {
    beforeEach(() => {
        vi.clearAllMocks();
        mockGetCurrentContext.mockResolvedValue({ userId: "user-1", teamId: "team-1" });
        mockCheckTeamPermission.mockResolvedValue(true);
        mockBuildGoogleMailboxAuthUrl.mockResolvedValue("https://accounts.google.com/o/oauth2/auth");
        mockUpdateMailboxControls.mockResolvedValue({ id: "mailbox-1" });
        mockPrisma.connectedMailbox.deleteMany.mockResolvedValue({ count: 1 });
    });

    it("POST rejects a caller below ADMIN role before starting the OAuth flow", async () => {
        mockCheckTeamPermission.mockResolvedValue(false);

        const res = await POST(jsonRequest({}));

        expect(res.status).toBe(403);
        expect(mockBuildGoogleMailboxAuthUrl).not.toHaveBeenCalled();
    });

    it("POST succeeds for an ADMIN caller", async () => {
        const res = await POST(jsonRequest({}));

        expect(res.status).toBe(200);
        expect(mockBuildGoogleMailboxAuthUrl).toHaveBeenCalled();
    });

    it("PATCH rejects a caller below ADMIN role before touching mailbox controls", async () => {
        mockCheckTeamPermission.mockResolvedValue(false);

        const res = await PATCH(jsonRequest({ mailboxId: "mailbox-1", status: "DISABLED" }));

        expect(res.status).toBe(403);
        expect(mockUpdateMailboxControls).not.toHaveBeenCalled();
    });

    it("PATCH succeeds for an ADMIN caller", async () => {
        const res = await PATCH(jsonRequest({ mailboxId: "mailbox-1", status: "DISABLED" }));

        expect(res.status).toBe(200);
        expect(mockUpdateMailboxControls).toHaveBeenCalledWith("team-1", "mailbox-1", { status: "DISABLED" });
    });

    it("DELETE rejects a caller below ADMIN role before disconnecting the mailbox", async () => {
        mockCheckTeamPermission.mockResolvedValue(false);

        const res = await DELETE(jsonRequest({ mailboxId: "mailbox-1" }));

        expect(res.status).toBe(403);
        expect(mockPrisma.connectedMailbox.deleteMany).not.toHaveBeenCalled();
    });

    it("DELETE succeeds for an ADMIN caller", async () => {
        const res = await DELETE(jsonRequest({ mailboxId: "mailbox-1" }));

        expect(res.status).toBe(200);
        expect(mockPrisma.connectedMailbox.deleteMany).toHaveBeenCalledWith({
            where: { id: "mailbox-1", teamId: "team-1" },
        });
    });
});
