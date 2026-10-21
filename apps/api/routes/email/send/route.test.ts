import { beforeEach, describe, expect, it, vi } from "vitest";

const { mockGetCurrentContext, mockCheckTeamPermission, mockSendEmail } = vi.hoisted(() => ({
    mockGetCurrentContext: vi.fn(),
    mockCheckTeamPermission: vi.fn(),
    mockSendEmail: vi.fn(),
}));

vi.mock("@/lib/auth", () => ({ getCurrentContext: mockGetCurrentContext }));
vi.mock("@/lib/db", () => ({ prisma: { campaign: { findFirst: vi.fn() } } }));
vi.mock("@/lib/permissions", () => ({
    TeamRole: { MEMBER: "member" },
    checkTeamPermission: mockCheckTeamPermission,
}));
vi.mock("@/modules/email-campaigner", () => ({ emailService: { sendEmail: mockSendEmail } }));

import { POST } from "./route";

const request = () =>
    new Request("http://localhost/email/send", {
        method: "POST",
        body: JSON.stringify({ to: "someone@example.com", subject: "Hi", html: "<p>Hi</p>" }),
    }) as any;

describe("POST /email/send", () => {
    beforeEach(() => {
        vi.clearAllMocks();
        mockGetCurrentContext.mockResolvedValue({ userId: "user-1", teamId: "team-a" });
        mockSendEmail.mockResolvedValue({ success: true, providerId: "m-1" });
    });

    it("refuses a caller below MEMBER without sending anything", async () => {
        mockCheckTeamPermission.mockResolvedValue(false);

        const res = await POST(request());

        expect(res.status).toBe(403);
        expect(mockCheckTeamPermission).toHaveBeenCalledWith("user-1", "team-a", "member");
        expect(mockSendEmail).not.toHaveBeenCalled();
    });

    it("sends for a MEMBER", async () => {
        mockCheckTeamPermission.mockResolvedValue(true);

        const res = await POST(request());

        expect(res.status).toBe(200);
        expect(mockSendEmail).toHaveBeenCalledTimes(1);
    });
});
