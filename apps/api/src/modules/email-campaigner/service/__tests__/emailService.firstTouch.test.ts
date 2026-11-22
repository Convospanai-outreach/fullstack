import { beforeEach, describe, expect, it, Mock, vi } from "vitest";
import { emailService } from "../emailService";
import { prisma } from "@/lib/db";
import { sendViaSMTP } from "@/lib/email/smtpClient";
import { getSmtpConfig } from "../smtpConfigService";
import { isSuppressed, selectMailboxForSend } from "../googleMailboxService";

const { mockPrisma } = vi.hoisted(() => ({
    mockPrisma: {
        lead: { findUnique: vi.fn() },
        campaign: { findUnique: vi.fn() },
        email: { create: vi.fn(), count: vi.fn() },
        team: { findUnique: vi.fn() },
        connectedMailbox: { findFirst: vi.fn() },
        campaignAttachment: { findMany: vi.fn().mockResolvedValue([]) },
    },
}));

vi.mock("@/lib/db", () => ({ prisma: mockPrisma }));
vi.mock("@/lib/email/smtpClient", () => ({ sendViaSMTP: vi.fn() }));
vi.mock("../smtpConfigService", () => ({ getSmtpConfig: vi.fn(), sendViaSmtpMailbox: vi.fn() }));
vi.mock("../googleMailboxService", () => ({
    isSuppressed: vi.fn(),
    selectMailboxForSend: vi.fn(),
    sendViaGmailMailbox: vi.fn(),
    signTrackedUrl: vi.fn(() => "sig"),
}));
vi.mock("../resendMailboxService", () => ({ sendViaResendMailbox: vi.fn() }));

const metadata = { teamId: "team-1", userId: "user-1", leadId: "lead-1", campaignId: "campaign-1" };
const READY_BRANDING = { privacyContactEmail: "privacy@acme.example", firstTouchNoticeText: "You are receiving this because your company was listed as a logistics supplier." };

function team(over: Record<string, unknown> = {}) {
    return { name: "Acme Sales", mailingAddress: "1 Main St", branding: READY_BRANDING, sendSafety: { DPDP_FIRST_TOUCH_NOTICE: true }, ...over };
}

describe("emailService - first-touch notice for leads without form consent (DPDP)", () => {
    beforeEach(() => {
        vi.clearAllMocks();
        (isSuppressed as Mock).mockResolvedValue(false);
        (selectMailboxForSend as Mock).mockResolvedValue(null);
        (prisma.campaign.findUnique as Mock).mockResolvedValue(null);
        (getSmtpConfig as Mock).mockResolvedValue({ host: "h", port: 587, secure: false, user: "u", password: "p", fromName: "S", fromEmail: "s@example.test" });
        (sendViaSMTP as Mock).mockResolvedValue({ success: true, messageId: "m1" });
        (prisma.email.create as Mock).mockResolvedValue({ id: "e1" });
        (prisma.email.count as Mock).mockResolvedValue(0);
        (prisma.lead.findUnique as Mock).mockResolvedValue({ status: "NEW", teamId: "team-1", source: "csv_import" });
        (prisma.team.findUnique as Mock).mockResolvedValue(team());
    });

    const send = () => emailService.sendEmail("lead@example.com", "Hello", "<p>Hi there</p>", metadata);
    const html = () => JSON.stringify((sendViaSMTP as Mock).mock.calls[0]);

    it("adds who is writing, why, how to stop and the privacy contact to the first email", async () => {
        const res = await send();

        expect(res.success).toBe(true);
        const out = html();
        expect(out).toContain("Acme Sales");
        expect(out).toContain("your company was listed as a logistics supplier");
        expect(out).toContain("privacy@acme.example");
        expect(out).toMatch(/unsubscribe/i);
    });

    it("leaves the second email alone", async () => {
        (prisma.email.count as Mock).mockResolvedValue(1);

        await send();

        expect(html()).not.toContain("your company was listed as a logistics supplier");
        expect(html()).not.toContain("privacy@acme.example");
    });

    it.each(["csv_import", "CSV_IMPORT", "hunter", "netjana-intel", "Netjana", "manual"])("treats a lead from %s as needing the notice", async (source) => {
        (prisma.lead.findUnique as Mock).mockResolvedValue({ status: "NEW", teamId: "team-1", source });

        await send();

        expect(html()).toContain("privacy@acme.example");
    });

    it.each(["landing_page", "landing_form", "facebook_lead_ads", null])("does not change an email to a lead from %s", async (source) => {
        (prisma.lead.findUnique as Mock).mockResolvedValue({ status: "NEW", teamId: "team-1", source });

        await send();

        expect(html()).not.toContain("privacy@acme.example");
        expect(prisma.email.count).not.toHaveBeenCalled();
    });

    it("changes nothing while the team flag is off", async () => {
        (prisma.team.findUnique as Mock).mockResolvedValue(team({ sendSafety: null }));

        const res = await send();

        expect(res.success).toBe(true);
        expect(html()).not.toContain("privacy@acme.example");
        expect(prisma.email.count).not.toHaveBeenCalled();
    });

    it("does not send, and says why, when the flag is on but the notice or privacy contact is not set", async () => {
        (prisma.team.findUnique as Mock).mockResolvedValue(team({ branding: { privacyContactEmail: "privacy@acme.example" } }));

        const res = await send();

        expect(res).toEqual({ success: false, error: "FIRST_TOUCH_NOTICE_NOT_SET" });
        expect(sendViaSMTP).not.toHaveBeenCalled();
    });

    it("never sends the [EDIT ME] placeholder to a person", async () => {
        (prisma.team.findUnique as Mock).mockResolvedValue(team({ branding: { privacyContactEmail: "privacy@acme.example", firstTouchNoticeText: "[EDIT ME] we found you online" } }));

        const res = await send();

        expect(res.success).toBe(false);
        expect(sendViaSMTP).not.toHaveBeenCalled();
    });

    it("escapes the team's text so it cannot add markup to the email", async () => {
        (prisma.team.findUnique as Mock).mockResolvedValue(team({ branding: { ...READY_BRANDING, firstTouchNoticeText: "Listed <script>x</script> publicly" } }));

        await send();

        expect(html()).not.toContain("<script>x</script>");
    });
});
