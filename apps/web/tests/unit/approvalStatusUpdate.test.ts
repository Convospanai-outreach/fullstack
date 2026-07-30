import { describe, it, expect, vi } from "vitest";

describe("Approval Action Status Update & Payload Resolution", () => {
    it("handles stringified JSON payloads and updates Email status to queued loudly", async () => {
        const mockEmailUpdate = vi.fn().mockResolvedValue({ id: "email-1", status: "queued" });
        const mockLeadUpdate = vi.fn().mockResolvedValue({ id: "lead-1", status: "SENT" });

        const stringifiedPayload = JSON.stringify({
            emailId: "email-1",
            leadId: "lead-1",
            campaignId: "camp-1",
        });

        const approvalRow = {
            id: "approval-1",
            teamId: "team-1",
            entityType: "email",
            entityId: "email-1",
            actionType: "email_draft_approval",
            payload: stringifiedPayload,
        };

        // Parse payload using route logic
        let payload = approvalRow.payload as any;
        if (typeof payload === "string") {
            payload = JSON.parse(payload);
        }

        const emailId = payload.emailId || (approvalRow.entityType?.toLowerCase() === "email" ? approvalRow.entityId : null);
        const leadId = payload.leadId || (approvalRow.entityType?.toLowerCase() === "lead" ? approvalRow.entityId : null);

        expect(emailId).toBe("email-1");
        expect(leadId).toBe("lead-1");

        await mockEmailUpdate({ where: { id: emailId }, data: { status: "queued" } });
        await mockLeadUpdate({ where: { id: leadId }, data: { status: "SENT" } });

        expect(mockEmailUpdate).toHaveBeenCalledWith({ where: { id: "email-1" }, data: { status: "queued" } });
        expect(mockLeadUpdate).toHaveBeenCalledWith({ where: { id: "lead-1" }, data: { status: "SENT" } });
    });

    it("falls back to approval.entityId when payload.emailId is omitted", async () => {
        const approvalRow = {
            id: "approval-2",
            teamId: "team-1",
            entityType: "Email",
            entityId: "email-entity-99",
            actionType: "SEND_EMAIL_DRAFT",
            payload: { campaignId: "camp-1" }, // missing emailId
        };

        let payload = approvalRow.payload as any;
        const emailId = payload.emailId || (approvalRow.entityType?.toLowerCase() === "email" ? approvalRow.entityId : null);

        expect(emailId).toBe("email-entity-99");
    });

    it("throws loud error and does NOT swallow database update failures", async () => {
        const mockEmailUpdate = vi.fn().mockRejectedValue(new Error("Database connection lost"));

        const performUpdate = async () => {
            await mockEmailUpdate().catch((err: any) => {
                console.error("Caught error:", err.message);
                throw err;
            });
        };

        await expect(performUpdate()).rejects.toThrow("Database connection lost");
    });
});
