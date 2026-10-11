import { beforeEach, describe, expect, it, vi } from "vitest";
import crypto from "crypto";

const mockDb: any = vi.hoisted(() => ({
    keywordTriggerReply: { findFirst: vi.fn() },
    lead: { findFirst: vi.fn(), create: vi.fn() },
}));
const merge = vi.hoisted(() => vi.fn());
const enabled = vi.hoisted(() => vi.fn());
const afterSocialSignup = vi.hoisted(() => vi.fn());

vi.mock("@/lib/db", () => ({ prisma: mockDb }));
vi.mock("@/lib/logger", () => ({ logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() } }));
vi.mock("../socialLinkMerge", () => ({ mergeSignupIntoSocialLead: merge }));
vi.mock("../featureGate", () => ({ isCreatorFunnelEnabled: enabled }));
vi.mock("@/workers/handlers/landing-lead-intake-worker", () => ({ afterSocialSignup }));

import { ingestMauticWebhook, readSubmission, verifyMauticSignature, MAUTIC_FORM_EVENT } from "../mauticSubmission";
import { signLinkToken } from "../linkToken";

const submission = (results: Record<string, unknown>, extra: Record<string, unknown> = {}) => ({
    submission: { id: 1, referer: "https://mautic.craftmyfunnel.live/guide?utm_content=post-1", dateSubmitted: new Date().toISOString(), results, ...extra },
    timestamp: new Date().toISOString(),
});
const body = (...items: unknown[]) => ({ [MAUTIC_FORM_EVENT]: items });

describe("mauticSubmission", () => {
    beforeEach(() => {
        vi.clearAllMocks();
        process.env["NEXTAUTH_SECRET"] = "s".repeat(32);
        mockDb.keywordTriggerReply.findFirst.mockResolvedValue({ teamId: "team-a" });
        enabled.mockResolvedValue(true);
        merge.mockResolvedValue("lead-1");
    });

    it("verifies Mautic's base64 HMAC-SHA256 over the exact bytes", () => {
        const raw = Buffer.from('{"a": "caf\\u00e9 \\/ x"}');
        const sig = crypto.createHmac("sha256", "secret").update(raw).digest("base64");
        expect(verifyMauticSignature(raw, sig, "secret")).toBe(true);
        expect(verifyMauticSignature(raw, sig, "other")).toBe(false);
        expect(verifyMauticSignature(raw, null, "secret")).toBe(false);
        expect(verifyMauticSignature(Buffer.from('{"a":"x"}'), sig, "secret")).toBe(false);
    });

    it("reads the token from the field or the page URL, and the contact fields", () => {
        const viaField = readSubmission(submission({ t: "tok", email: " A@B.co ", firstname: "Ann", lastname: "Lee", position: "CEO" }));
        expect(viaField).toMatchObject({ token: "tok", email: "a@b.co", name: "Ann Lee", title: "CEO", utmContent: "post-1" });
        const viaUrl = readSubmission(submission({ email: "not-an-email" }, { referer: "https://mautic.craftmyfunnel.live/guide?t=abc.def" }));
        expect(viaUrl).toMatchObject({ token: "abc.def", email: undefined });
        expect(readSubmission({})).toBeNull();
    });

    it("takes the team only from a valid signed token, never from the form", async () => {
        const noToken = await ingestMauticWebhook(body(submission({ email: "a@b.co", team: "team-evil", teamId: "team-evil" })));
        const forged = await ingestMauticWebhook(body(submission({ t: "eyJyIjoieCJ9.bad", email: "a@b.co" })));
        expect(noToken.dropped).toBe(1);
        expect(forged.dropped).toBe(1);
        expect(mockDb.keywordTriggerReply.findFirst).not.toHaveBeenCalled();

        const token = signLinkToken("reply-1");
        const ok = await ingestMauticWebhook(body(submission({ t: token, email: "a@b.co", teamId: "team-evil" })));
        expect(ok).toMatchObject({ merged: 1, dropped: 0, failed: 0 });
        expect(mockDb.keywordTriggerReply.findFirst).toHaveBeenCalledWith({ where: { id: "reply-1" }, select: { teamId: true } });
        expect(merge).toHaveBeenCalledWith(expect.objectContaining({ teamId: "team-a", socialToken: token, email: "a@b.co" }));
        expect(afterSocialSignup).toHaveBeenCalledWith("team-a", "lead-1", "post-1");
    });

    it("drops submissions for teams without the creator funnel or unknown replies", async () => {
        const token = signLinkToken("reply-1");
        enabled.mockResolvedValue(false);
        expect((await ingestMauticWebhook(body(submission({ t: token, email: "a@b.co" })))).dropped).toBe(1);
        enabled.mockResolvedValue(true);
        mockDb.keywordTriggerReply.findFirst.mockResolvedValue(null);
        expect((await ingestMauticWebhook(body(submission({ t: token, email: "a@b.co" })))).dropped).toBe(1);
        expect(afterSocialSignup).not.toHaveBeenCalled();
    });

    it("falls back to the team's lead with that email, or a new one, when the merge can't be done safely", async () => {
        const token = signLinkToken("reply-1");
        merge.mockResolvedValue(null);
        mockDb.lead.findFirst.mockResolvedValueOnce({ id: "lead-9" });
        expect((await ingestMauticWebhook(body(submission({ t: token, email: "a@b.co" })))).joined).toBe(1);
        expect(mockDb.lead.findFirst).toHaveBeenCalledWith(expect.objectContaining({ where: { teamId: "team-a", email: { equals: "a@b.co", mode: "insensitive" } } }));
        expect(afterSocialSignup).toHaveBeenCalledWith("team-a", "lead-9", "post-1");

        mockDb.lead.findFirst.mockResolvedValueOnce(null);
        mockDb.lead.create.mockResolvedValue({ id: "lead-new" });
        expect((await ingestMauticWebhook(body(submission({ t: token, email: "new@b.co", firstname: "Nia" })))).created).toBe(1);
        expect(mockDb.lead.create).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ teamId: "team-a", email: "new@b.co", fullName: "Nia", source: "mautic_form" }) }));

        expect((await ingestMauticWebhook(body(submission({ t: token })))).dropped).toBe(1);
    });

    it("counts a failing submission so the route answers non-2xx and Mautic retries", async () => {
        merge.mockRejectedValue(new Error("db down"));
        const result = await ingestMauticWebhook(body(submission({ t: signLinkToken("reply-1"), email: "a@b.co" })));
        expect(result.failed).toBe(1);
    });
});
