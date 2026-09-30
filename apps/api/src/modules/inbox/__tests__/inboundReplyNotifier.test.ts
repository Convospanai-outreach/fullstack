import { describe, expect, it, vi, beforeEach } from "vitest";

const mockDb: any = vi.hoisted(() => ({
    lead: { findUnique: vi.fn() },
    message: { count: vi.fn() },
    teamMember: { findMany: vi.fn() },
    emailEvent: { findUnique: vi.fn() },
}));

vi.mock("@/lib/db", () => ({ prisma: mockDb }));
vi.mock("@/lib/notifications", () => ({ NotificationDispatcher: { send: vi.fn() } }));

import { onInboundReply, onMeetingCreated } from "../inboundReplyNotifier";
import { NotificationDispatcher } from "@/lib/notifications";

const createdAt = new Date("2026-09-30T08:00:00Z");
const reply = (overrides: any = {}) => ({ id: "msg-1", leadId: "lead-1", sentimentScore: null, emailEventId: "event-1", createdAt, ...overrides });

describe("onInboundReply", () => {
    beforeEach(() => {
        vi.clearAllMocks();
        mockDb.lead.findUnique.mockResolvedValue({ fullName: "Asha <b>Rao</b>", email: "asha@acme.test", teamId: "team-a" });
        mockDb.message.count.mockResolvedValue(0);
        mockDb.teamMember.findMany.mockResolvedValue([{ userId: "user-1" }, { userId: "user-2" }]);
        mockDb.emailEvent.findUnique.mockResolvedValue({ mailbox: { assignedUserId: null } });
    });

    it("alerts the whole team when the receiving mailbox has no assigned rep, keeping lead data out of the email body", async () => {
        await onInboundReply(reply());

        expect(NotificationDispatcher.send).toHaveBeenCalledTimes(2);
        const [userId, type, title, message] = (NotificationDispatcher.send as any).mock.calls[0];
        expect(userId).toBe("user-1");
        expect(type).toBe("LEAD");
        expect(title).toBe("New reply from Asha <b>Rao</b>");
        expect(message).not.toContain("Asha");
        expect(message).toContain("https://craftmyfunnel.live/inbox");
    });

    it("alerts only the mailbox's assigned rep when that rep is an active member", async () => {
        mockDb.emailEvent.findUnique.mockResolvedValue({ mailbox: { assignedUserId: "user-2" } });

        await onInboundReply(reply());

        expect(NotificationDispatcher.send).toHaveBeenCalledTimes(1);
        expect((NotificationDispatcher.send as any).mock.calls[0][0]).toBe("user-2");
    });

    it("skips clearly negative replies but alerts on unscored and positive ones", async () => {
        await onInboundReply(reply({ sentimentScore: 0.1 }));
        expect(NotificationDispatcher.send).not.toHaveBeenCalled();

        await onInboundReply(reply({ sentimentScore: 0.3 }));
        expect(NotificationDispatcher.send).toHaveBeenCalled();
    });

    it("sends at most one alert per lead per 6h", async () => {
        mockDb.message.count.mockResolvedValue(1);

        await onInboundReply(reply());

        expect(mockDb.message.count).toHaveBeenCalledWith({
            where: {
                leadId: "lead-1",
                direction: "INBOUND",
                id: { not: "msg-1" },
                createdAt: { gte: new Date("2026-09-30T02:00:00Z"), lte: createdAt },
            },
        });
        expect(NotificationDispatcher.send).not.toHaveBeenCalled();
    });

    it("never throws, so a failed alert can't affect reply ingestion", async () => {
        mockDb.lead.findUnique.mockRejectedValue(new Error("db down"));
        const consoleError = vi.spyOn(console, "error").mockImplementation(() => undefined);

        await expect(onInboundReply(reply())).resolves.toBeUndefined();
        consoleError.mockRestore();
    });
});

describe("onMeetingCreated", () => {
    beforeEach(() => {
        vi.clearAllMocks();
        mockDb.teamMember.findMany.mockResolvedValue([{ userId: "creator" }, { userId: "teammate" }]);
    });

    it("alerts the rest of the team, not the rep who created it", async () => {
        await onMeetingCreated({ id: "meeting-1", teamId: "team-a", title: "Demo\r\nwith Acme", leadId: "lead-1" }, "creator");

        expect(mockDb.teamMember.findMany).toHaveBeenCalledWith(expect.objectContaining({ where: { teamId: "team-a", status: "active", userId: { not: null } } }));
        expect(NotificationDispatcher.send).toHaveBeenCalledTimes(1);
        expect(NotificationDispatcher.send).toHaveBeenCalledWith("teammate", "LEAD", "Meeting booked: Demo with Acme", expect.any(String), { meetingId: "meeting-1", leadId: "lead-1" });
    });
});
