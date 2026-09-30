import { describe, expect, it, vi, beforeEach } from "vitest";

const mockDb: any = vi.hoisted(() => ({
    message: { count: vi.fn(), findMany: vi.fn() },
    approvalRequest: { count: vi.fn(), findMany: vi.fn() },
    email: { count: vi.fn(), findMany: vi.fn() },
    overseerNudge: { count: vi.fn(), findMany: vi.fn() },
    connectedMailbox: { count: vi.fn(), findMany: vi.fn() },
    meeting: { count: vi.fn(), findMany: vi.fn() },
}));

vi.mock("@/lib/db", () => ({ prisma: mockDb }));

import { collectNeedsYou } from "../needsYouService";

// 08:15 IST on 2026-09-30.
const eightFifteenIst = new Date("2026-09-30T02:45:00Z");
const at = new Date("2026-09-30T01:00:00Z");

function stubEmpty() {
    for (const model of Object.values(mockDb) as any[]) {
        model.count.mockResolvedValue(0);
        model.findMany.mockResolvedValue([]);
    }
}

describe("collectNeedsYou", () => {
    beforeEach(() => {
        vi.clearAllMocks();
        stubEmpty();
    });

    it("returns every type, in order, even when nothing is waiting", async () => {
        const items = await collectNeedsYou(["team-a"], eightFifteenIst);

        expect(items.map((item) => [item.type, item.count, item.top.length])).toEqual([
            ["unread_replies", 0, 0],
            ["approvals", 0, 0],
            ["approved_not_sent", 0, 0],
            ["stalled_leads", 0, 0],
            ["mailbox_issues", 0, 0],
            ["meetings_today", 0, 0],
        ]);
    });

    it("scopes every query to the given teams, uses IST day bounds and caps each list at 3", async () => {
        await collectNeedsYou(["team-a", "team-b"], eightFifteenIst);
        const inTeams = { in: ["team-a", "team-b"] };

        expect(mockDb.message.count).toHaveBeenCalledWith({ where: { direction: "INBOUND", isRead: false, lead: { teamId: inTeams } } });
        expect(mockDb.approvalRequest.count).toHaveBeenCalledWith({ where: { teamId: inTeams, status: "PENDING" } });
        expect(mockDb.email.count).toHaveBeenCalledWith({ where: { lead: { teamId: inTeams }, status: "queued" } });
        expect(mockDb.overseerNudge.count).toHaveBeenCalledWith({ where: { teamId: inTeams, status: "OPEN" } });
        expect(mockDb.connectedMailbox.count).toHaveBeenCalledWith({ where: { teamId: inTeams, status: "NEEDS_RECONNECT" } });
        expect(mockDb.meeting.count).toHaveBeenCalledWith({
            where: { teamId: inTeams, startTime: { gte: new Date("2026-09-29T18:30:00Z"), lt: new Date("2026-09-30T18:30:00Z") } },
        });
        for (const model of Object.values(mockDb) as any[]) {
            expect(model.findMany).toHaveBeenCalledWith(expect.objectContaining({ take: 3 }));
        }
    });

    it("links each entry to the exact thing to act on", async () => {
        mockDb.message.count.mockResolvedValue(5);
        mockDb.message.findMany.mockResolvedValue([{ id: "msg 1", content: "<p>Yes, Tuesday works</p>", createdAt: at, lead: { fullName: "Asha", email: null } }]);
        mockDb.approvalRequest.count.mockResolvedValue(1);
        mockDb.approvalRequest.findMany.mockResolvedValue([{ id: "apr-1", actionType: "email_draft_approval", payload: { subject: "Quick question" }, createdAt: at }]);
        mockDb.email.count.mockResolvedValue(1);
        mockDb.email.findMany.mockResolvedValue([{ id: "em-1", subject: "Intro", leadId: "lead-9", createdAt: at, lead: { fullName: null, email: "raj@example.test" } }]);
        mockDb.overseerNudge.count.mockResolvedValue(1);
        mockDb.overseerNudge.findMany.mockResolvedValue([{ id: "n-1", suggestion: "Resend step 2", leadId: null, createdAt: at }]);
        mockDb.connectedMailbox.count.mockResolvedValue(1);
        mockDb.connectedMailbox.findMany.mockResolvedValue([{ id: "mb-1", email: "sales@acme.test", displayName: null }]);

        const items = await collectNeedsYou(["team-a"], eightFifteenIst);
        const byType = Object.fromEntries(items.map((item) => [item.type, item]));

        expect(byType["unread_replies"]).toMatchObject({
            count: 5,
            top: [{ id: "msg 1", title: "Asha", detail: "Yes, Tuesday works", href: "/inbox?reply=msg%201" }],
        });
        expect(byType["approvals"]!.top[0]).toMatchObject({ title: "Email Draft Approval", detail: "Quick question", href: "/inbox?tab=approvals" });
        expect(byType["approved_not_sent"]!.top[0]).toMatchObject({ title: "raj@example.test", detail: "Intro", href: "/leads/lead-9" });
        expect(byType["stalled_leads"]!.top[0]).toMatchObject({ title: "Resend step 2", href: "/inbox?tab=approvals" });
        expect(byType["mailbox_issues"]!.top[0]).toMatchObject({ title: "sales@acme.test", href: "/settings/mailboxes" });
    });
});
