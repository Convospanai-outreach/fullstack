import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";

const mockDb: any = vi.hoisted(() => ({
    user: { updateMany: vi.fn() },
    team: { updateMany: vi.fn(), findMany: vi.fn() },
    email: { findFirst: vi.fn() },
}));
const captureImmediate = vi.hoisted(() => vi.fn());
const PostHog = vi.hoisted(() => vi.fn(function (this: any) { this.captureImmediate = captureImmediate; }));

vi.mock("@/lib/db", () => ({ prisma: mockDb }));
vi.mock("posthog-node", () => ({ PostHog }));

import {
    markActiveDay,
    markFirstPositiveReply,
    resetProductEventsForTests,
    sweepFirstCampaignSends,
    trackMeetingBooked,
} from "../productEvents";

// 08:15 IST on 2026-09-30.
const now = new Date("2026-09-30T02:45:00Z");

describe("productEvents", () => {
    const originalKey = process.env["POSTHOG_API_KEY"];

    beforeEach(() => {
        vi.clearAllMocks();
        resetProductEventsForTests();
        process.env["POSTHOG_API_KEY"] = "phc_test";
        captureImmediate.mockResolvedValue(undefined);
        mockDb.user.updateMany.mockResolvedValue({ count: 1 });
        mockDb.team.updateMany.mockResolvedValue({ count: 1 });
    });

    afterEach(() => {
        process.env["POSTHOG_API_KEY"] = originalKey;
    });

    it("does nothing, and claims no milestone, without POSTHOG_API_KEY", async () => {
        delete process.env["POSTHOG_API_KEY"];
        resetProductEventsForTests();

        await trackMeetingBooked("team-a", "user-1", "meeting-1");
        await markActiveDay("user-1", "team-a", now);
        await markFirstPositiveReply("team-a", "user-1", "interested", now);
        expect(await sweepFirstCampaignSends()).toBe(0);

        expect(PostHog).not.toHaveBeenCalled();
        expect(mockDb.user.updateMany).not.toHaveBeenCalled();
        expect(mockDb.team.updateMany).not.toHaveBeenCalled();
        expect(mockDb.team.findMany).not.toHaveBeenCalled();
    });

    it("sends session_active_day once per IST day, claimed on User.lastActiveDay", async () => {
        await markActiveDay("user-1", "team-a", now);

        const today = new Date("2026-09-30T00:00:00Z");
        expect(mockDb.user.updateMany).toHaveBeenCalledWith({
            where: { id: "user-1", OR: [{ lastActiveDay: null }, { lastActiveDay: { not: today } }] },
            data: { lastActiveDay: today },
        });
        expect(captureImmediate).toHaveBeenCalledWith({
            distinctId: "user-1",
            event: "session_active_day",
            properties: { team_id: "team-a", source: "api" },
        });

        mockDb.user.updateMany.mockResolvedValue({ count: 0 });
        await markActiveDay("user-1", "team-a", now);
        expect(captureImmediate).toHaveBeenCalledTimes(1);
    });

    it("sends aha_first_positive_reply only for the team's first interested or meeting-booked outcome", async () => {
        await markFirstPositiveReply("team-a", "user-1", "not_interested", now);
        expect(mockDb.team.updateMany).not.toHaveBeenCalled();

        await markFirstPositiveReply("team-a", "user-1", "interested", now);
        expect(mockDb.team.updateMany).toHaveBeenCalledWith({ where: { id: "team-a", firstPositiveReplyAt: null }, data: { firstPositiveReplyAt: now } });
        expect(captureImmediate).toHaveBeenCalledWith(expect.objectContaining({ distinctId: "user-1", event: "aha_first_positive_reply" }));

        mockDb.team.updateMany.mockResolvedValue({ count: 0 });
        await markFirstPositiveReply("team-a", "user-2", "meeting_booked", now);
        expect(captureImmediate).toHaveBeenCalledTimes(1);
    });

    it("sends meeting_booked for every meeting, falling back to the team as the actor", async () => {
        await trackMeetingBooked("team-a", null, "meeting-1");

        expect(captureImmediate).toHaveBeenCalledWith({
            distinctId: "team:team-a",
            event: "meeting_booked",
            properties: { team_id: "team-a", meeting_id: "meeting-1", source: "api" },
        });
    });

    it("sweeps teams whose first provider-accepted email has no activation yet, stamped with that email's time", async () => {
        const sentAt = new Date("2026-09-01T10:00:00Z");
        mockDb.team.findMany.mockResolvedValue([{ id: "team-a" }, { id: "team-b" }]);
        mockDb.email.findFirst
            .mockResolvedValueOnce({ createdAt: sentAt, campaignId: "camp-1", campaign: { ownerId: "owner-1" } })
            .mockResolvedValueOnce({ createdAt: sentAt, campaignId: "camp-2", campaign: { ownerId: null } });
        mockDb.team.updateMany.mockResolvedValueOnce({ count: 1 }).mockResolvedValueOnce({ count: 0 });

        expect(await sweepFirstCampaignSends()).toBe(1);

        expect(mockDb.team.findMany).toHaveBeenCalledWith(expect.objectContaining({
            where: { firstCampaignSentAt: null, campaigns: { some: { emails: { some: { providerId: { not: null } } } } } },
        }));
        expect(mockDb.team.updateMany).toHaveBeenCalledWith({ where: { id: "team-a", firstCampaignSentAt: null }, data: { firstCampaignSentAt: sentAt } });
        expect(captureImmediate).toHaveBeenCalledTimes(1);
        expect(captureImmediate).toHaveBeenCalledWith({
            distinctId: "owner-1",
            event: "activation_first_campaign_sent",
            properties: { team_id: "team-a", campaign_id: "camp-1", source: "api" },
            timestamp: sentAt,
        });
    });

    it("never throws when PostHog or the database fails", async () => {
        const consoleError = vi.spyOn(console, "error").mockImplementation(() => undefined);
        captureImmediate.mockRejectedValue(new Error("network"));
        await expect(trackMeetingBooked("team-a", "user-1", "meeting-1")).resolves.toBeUndefined();

        mockDb.user.updateMany.mockRejectedValue(new Error("db down"));
        await expect(markActiveDay("user-1", "team-a", now)).resolves.toBeUndefined();

        mockDb.team.findMany.mockRejectedValue(new Error("db down"));
        await expect(sweepFirstCampaignSends()).resolves.toBe(0);
        consoleError.mockRestore();
    });
});
