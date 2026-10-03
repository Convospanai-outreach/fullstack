import { beforeEach, describe, expect, it, vi } from "vitest";

const mockDb = vi.hoisted(() => ({
    keywordTriggerReply: { findFirst: vi.fn() },
    lead: { findFirst: vi.fn(), updateMany: vi.fn() },
}));
vi.mock("@/lib/db", () => ({ prisma: mockDb }));

import { signLinkToken } from "../linkToken";
import { mergeSignupIntoSocialLead } from "../socialLinkMerge";

const SENT = new Date("2026-10-01T10:00:00Z");
const LATER = new Date("2026-10-02T10:00:00Z");

const signUp = (over: Record<string, unknown> = {}) => ({
    teamId: "team-a",
    socialToken: signLinkToken("reply-1", SENT),
    createdAt: LATER,
    email: " Asha@Example.com ",
    name: "Asha Rao",
    phone: "+9199",
    company: null,
    title: null,
    ...over,
});

const socialLead = (over: Record<string, unknown> = {}) => ({
    id: "lead-1",
    email: null,
    phone: null,
    fullName: "@asha",
    company: null,
    jobTitle: null,
    campaignId: null,
    ...over,
});

describe("mergeSignupIntoSocialLead", () => {
    beforeEach(() => {
        vi.clearAllMocks();
        process.env["NEXTAUTH_SECRET"] = "s".repeat(32);
        mockDb.keywordTriggerReply.findFirst.mockResolvedValue({ leadId: "lead-1" });
        mockDb.lead.findFirst.mockImplementation(async ({ where }: any) => (where.id === "lead-1" ? socialLead() : null));
        mockDb.lead.updateMany.mockResolvedValue({ count: 1 });
    });

    it("fills the social lead's empty fields from the sign-up", async () => {
        await expect(mergeSignupIntoSocialLead(signUp(), "campaign-1")).resolves.toBe("lead-1");
        expect(mockDb.keywordTriggerReply.findFirst).toHaveBeenCalledWith({ where: { id: "reply-1", teamId: "team-a" }, select: { leadId: true } });
        expect(mockDb.lead.findFirst).toHaveBeenCalledWith(expect.objectContaining({ where: { id: "lead-1", teamId: "team-a" } }));
        expect(mockDb.lead.findFirst).toHaveBeenCalledWith({ where: { teamId: "team-a", email: { equals: "asha@example.com", mode: "insensitive" }, id: { not: "lead-1" } }, select: { id: true } });
        expect(mockDb.lead.updateMany).toHaveBeenCalledWith({
            where: { id: "lead-1", teamId: "team-a", email: null },
            data: { email: "asha@example.com", fullName: "Asha Rao", phone: "+9199", company: undefined, jobTitle: undefined, campaignId: "campaign-1" },
        });
    });

    it("never overwrites what the lead already has", async () => {
        mockDb.lead.findFirst.mockImplementation(async ({ where }: any) =>
            where.id === "lead-1" ? socialLead({ email: "asha@example.com", phone: "+1", fullName: "Asha R", campaignId: "c-0" }) : null,
        );
        await expect(mergeSignupIntoSocialLead(signUp(), "campaign-1")).resolves.toBe("lead-1");
        expect(mockDb.lead.updateMany).toHaveBeenCalledWith({
            where: { id: "lead-1", teamId: "team-a", email: "asha@example.com" },
            data: { phone: "+1", company: undefined, jobTitle: undefined, campaignId: "c-0" },
        });
    });

    it("falls back when the lead has a different email", async () => {
        mockDb.lead.findFirst.mockImplementation(async ({ where }: any) => (where.id === "lead-1" ? socialLead({ email: "other@example.com" }) : null));
        await expect(mergeSignupIntoSocialLead(signUp())).resolves.toBeNull();
        expect(mockDb.lead.updateMany).not.toHaveBeenCalled();
    });

    it("falls back when another lead in the team already has the email", async () => {
        mockDb.lead.findFirst.mockImplementation(async ({ where }: any) => (where.id === "lead-1" ? socialLead() : { id: "lead-2" }));
        await expect(mergeSignupIntoSocialLead(signUp())).resolves.toBeNull();
        expect(mockDb.lead.updateMany).not.toHaveBeenCalled();
    });

    it("falls back when the lead changed under it", async () => {
        mockDb.lead.updateMany.mockResolvedValue({ count: 0 });
        await expect(mergeSignupIntoSocialLead(signUp())).resolves.toBeNull();
    });

    it("ignores forged, expired and missing tokens without touching the database", async () => {
        const genuine = signLinkToken("reply-1", SENT);
        for (const socialToken of [null, "", "abc.def", `${genuine}x`, genuine.replace(/^./, (c) => (c === "A" ? "B" : "A"))]) {
            await expect(mergeSignupIntoSocialLead(signUp({ socialToken }))).resolves.toBeNull();
        }
        await expect(mergeSignupIntoSocialLead(signUp({ createdAt: new Date(SENT.getTime() + 73 * 3600_000) }))).resolves.toBeNull();
        expect(mockDb.keywordTriggerReply.findFirst).not.toHaveBeenCalled();
    });

    it("ignores a genuine token from another team's auto-reply", async () => {
        mockDb.keywordTriggerReply.findFirst.mockResolvedValue(null);
        await expect(mergeSignupIntoSocialLead(signUp({ teamId: "team-b" }))).resolves.toBeNull();
        expect(mockDb.keywordTriggerReply.findFirst).toHaveBeenCalledWith({ where: { id: "reply-1", teamId: "team-b" }, select: { leadId: true } });
        expect(mockDb.lead.updateMany).not.toHaveBeenCalled();
    });

    it("falls back when the auto-reply has no lead yet", async () => {
        mockDb.keywordTriggerReply.findFirst.mockResolvedValue({ leadId: null });
        await expect(mergeSignupIntoSocialLead(signUp())).resolves.toBeNull();
        expect(mockDb.lead.findFirst).not.toHaveBeenCalled();
    });
});
