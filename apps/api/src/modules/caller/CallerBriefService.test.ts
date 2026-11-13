import { describe, expect, it, vi, beforeEach } from "vitest";

vi.mock("@/lib/db", () => ({
    prisma: {
        lead: { findFirst: vi.fn() },
        email: { findMany: vi.fn() },
        trackedLink: { findMany: vi.fn() },
        leadActivity: { findMany: vi.fn() },
        leadChannelStatus: { findMany: vi.fn() },
        whatsAppMessage: { findMany: vi.fn() },
        message: { findMany: vi.fn() },
        conversationEntry: { findMany: vi.fn() },
        meeting: { findMany: vi.fn() },
        conversationThread: { findMany: vi.fn() },
        landingLead: { findMany: vi.fn() },
        landingEvent: { findMany: vi.fn() },
        auditLog: { findMany: vi.fn() },
        user: { findMany: vi.fn() },
    },
}));

import { prisma } from "@/lib/db";
import { CallerBriefService } from "./CallerBriefService";

const p = prisma as any;

function emptyEverything() {
    for (const m of ["email", "trackedLink", "leadActivity", "leadChannelStatus", "whatsAppMessage", "message",
        "conversationEntry", "meeting", "conversationThread", "landingLead", "landingEvent", "auditLog", "user"]) {
        p[m].findMany.mockResolvedValue([]);
    }
}

describe("CallerBriefService.getBrief", () => {
    beforeEach(() => {
        vi.clearAllMocks();
        emptyEverything();
    });

    it("returns null and reads nothing else for a lead in another team", async () => {
        p.lead.findFirst.mockResolvedValue(null);

        expect(await CallerBriefService.getBrief("lead-b", "team-a")).toBeNull();

        expect(p.lead.findFirst).toHaveBeenCalledWith(expect.objectContaining({ where: { id: "lead-b", teamId: "team-a" } }));
        expect(p.email.findMany).not.toHaveBeenCalled();
        expect(p.conversationEntry.findMany).not.toHaveBeenCalled();
    });

    it("builds the brief: crystal guidance, engagement counts, call notes without auto entries", async () => {
        p.lead.findFirst.mockResolvedValue({
            id: "lead-1", email: "Jane@Acme.com", company: "Acme",
            enrichedData: { crystalKnows: { guidance: { discType: "D", archetype: "Driver", prompt: "Be brief" } } },
        });
        p.email.findMany.mockResolvedValue([
            { subject: "Hi", createdAt: new Date("2026-11-01"), openedAt: new Date("2026-11-02"), clickedAt: new Date("2026-11-03"), repliedAt: null, bouncedAt: null, campaign: { name: "Camp", ownerId: "u1" } },
        ]);
        p.user.findMany.mockResolvedValue([{ name: "Sid", email: "s@x.com" }]);
        p.conversationThread.findMany.mockResolvedValue([{ id: "t1" }]);
        p.auditLog.findMany.mockResolvedValue([
            { createdAt: new Date("2026-11-05"), metadata: { reason: "Auto: Queued for human caller" } },
            { createdAt: new Date("2026-11-06"), metadata: { reason: "Claimed by user u2" } },
            { createdAt: new Date("2026-11-07"), metadata: { reason: "Asked to call back Friday" } },
        ]);
        p.landingLead.findMany.mockResolvedValue([{ sessionId: "s1", landingPage: { title: "Ebook page", slug: "ebook" } }]);
        p.landingEvent.findMany.mockResolvedValue([{ eventName: "page_view" }, { eventName: "page_view" }, { eventName: "form_submit" }]);

        const brief = await CallerBriefService.getBrief("lead-1", "team-a");

        expect(brief!.crystal).toEqual({ discType: "D", archetype: "Driver", prompt: "Be brief" });
        expect(brief!.lead).not.toHaveProperty("enrichedData");
        expect(brief!.outreach).toMatchObject({ campaigns: ["Camp"], emailsSent: 1, opened: 1, clicked: 1, replied: 0 });
        expect(brief!.outreach.ranBy).toEqual([{ name: "Sid", email: "s@x.com" }]);
        expect(brief!.engagement.landing).toMatchObject({ pageViews: 2, formSubmits: 1, downloadTracked: false });
        expect(brief!.callNotes.map((n) => n.reason)).toEqual(["Asked to call back Friday"]);
        expect(p.landingLead.findMany).toHaveBeenCalledWith(expect.objectContaining({ where: expect.objectContaining({ teamId: "team-a" }) }));
        expect(brief!.timeline[0].kind).toBe("clicked");
    });
});
