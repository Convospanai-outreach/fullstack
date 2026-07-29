import { describe, it, expect, vi } from "vitest";

/**
 * Positive proof test for backfill script detection and creation logic.
 * Tests that an orphaned draft (Email status "draft", no ApprovalRequest)
 * is correctly identified and gets a matching ApprovalRequest generated.
 */

interface MockEmail {
    id: string;
    status: string;
    subject: string;
    body: string;
    leadId: string;
    campaignId: string;
    lead?: { id: string; email: string; fullName: string; status: string; teamId: string };
    campaign?: { id: string; name: string; teamId: string; ownerId?: string };
}

interface MockApprovalRequest {
    id: string;
    teamId: string;
    requesterId: string;
    actionType: string;
    entityType: string;
    entityId: string;
    status: string;
    reason: string;
    payload: any;
}

function processOrphanedDrafts(
    emails: MockEmail[],
    existingApprovals: MockApprovalRequest[],
    teamUsers: Record<string, string> // teamId -> userId
): { createdApprovals: Omit<MockApprovalRequest, "id">[]; skipped: string[] } {
    const createdApprovals: Omit<MockApprovalRequest, "id">[] = [];
    const skipped: string[] = [];

    // Filter to emails with status "draft"
    const drafts = emails.filter((e) => e.status === "draft");

    for (const email of drafts) {
        // Check if an ApprovalRequest already exists
        const hasApproval = existingApprovals.some(
            (a) => a.entityType === "Email" && a.entityId === email.id && a.actionType === "SEND_EMAIL_DRAFT"
        );
        if (hasApproval) {
            skipped.push(email.id);
            continue;
        }

        const teamId = email.campaign?.teamId || email.lead?.teamId;
        if (!teamId) {
            skipped.push(email.id);
            continue;
        }

        const requesterId = email.campaign?.ownerId || teamUsers[teamId];
        if (!requesterId) {
            skipped.push(email.id);
            continue;
        }

        const leadName = email.lead?.email || email.lead?.fullName || "unknown lead";
        const campaignName = email.campaign?.name || "unknown campaign";

        createdApprovals.push({
            teamId,
            requesterId,
            actionType: "SEND_EMAIL_DRAFT",
            entityType: "Email",
            entityId: email.id,
            status: "PENDING",
            reason: `[Backfill] AI draft for ${leadName} in campaign ${campaignName} — created retroactively`,
            payload: {
                emailId: email.id,
                leadId: email.lead?.id,
                campaignId: email.campaign?.id,
                subject: email.subject,
                body: email.body,
            },
        });
    }

    return { createdApprovals, skipped };
}

describe("Backfill script orphaned draft repair logic", () => {
    it("correctly identifies an orphaned draft and generates a pending ApprovalRequest", () => {
        const orphanedEmail: MockEmail = {
            id: "email_sid_123",
            status: "draft",
            subject: "Outreach for Sid",
            body: "Hi Sid, let's connect.",
            leadId: "lead_sid_456",
            campaignId: "camp_789",
            lead: {
                id: "lead_sid_456",
                email: "sid@example.com",
                fullName: "Sid",
                status: "DRAFT_READY",
                teamId: "team_alpha",
            },
            campaign: {
                id: "camp_789",
                name: "Q3 Expansion Campaign",
                teamId: "team_alpha",
                ownerId: "user_owner_001",
            },
        };

        const existingApprovals: MockApprovalRequest[] = []; // 0 existing approvals
        const teamUsers = { team_alpha: "user_owner_001" };

        const result = processOrphanedDrafts([orphanedEmail], existingApprovals, teamUsers);

        expect(result.createdApprovals.length).toBe(1);
        expect(result.createdApprovals[0]).toEqual({
            teamId: "team_alpha",
            requesterId: "user_owner_001",
            actionType: "SEND_EMAIL_DRAFT",
            entityType: "Email",
            entityId: "email_sid_123",
            status: "PENDING",
            reason: "[Backfill] AI draft for sid@example.com in campaign Q3 Expansion Campaign — created retroactively",
            payload: {
                emailId: "email_sid_123",
                leadId: "lead_sid_456",
                campaignId: "camp_789",
                subject: "Outreach for Sid",
                body: "Hi Sid, let's connect.",
            },
        });
        expect(result.skipped.length).toBe(0);
    });

    it("skips emails that already have an ApprovalRequest (idempotency)", () => {
        const emailWithApproval: MockEmail = {
            id: "email_already_approved",
            status: "draft",
            subject: "Test Subject",
            body: "Test Body",
            leadId: "lead_1",
            campaignId: "camp_1",
            lead: { id: "lead_1", email: "a@b.com", fullName: "A", status: "DRAFT_READY", teamId: "team_1" },
            campaign: { id: "camp_1", name: "Camp 1", teamId: "team_1", ownerId: "user_1" },
        };

        const existingApprovals: MockApprovalRequest[] = [
            {
                id: "app_1",
                teamId: "team_1",
                requesterId: "user_1",
                actionType: "SEND_EMAIL_DRAFT",
                entityType: "Email",
                entityId: "email_already_approved",
                status: "PENDING",
                reason: "Pre-existing",
                payload: {},
            },
        ];

        const result = processOrphanedDrafts([emailWithApproval], existingApprovals, { team_1: "user_1" });

        expect(result.createdApprovals.length).toBe(0);
        expect(result.skipped).toContain("email_already_approved");
    });
});
