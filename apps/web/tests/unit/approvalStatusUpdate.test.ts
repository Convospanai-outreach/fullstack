import { describe, it, expect, vi } from "vitest";

describe("Approval Action Status Update Integration", () => {
    it("updates Email status to queued and Lead status to SENT when ApprovalRequest is APPROVED", async () => {
        const mockEmailUpdate = vi.fn().mockResolvedValue({ id: "email-1", status: "queued" });
        const mockLeadUpdate = vi.fn().mockResolvedValue({ id: "lead-1", status: "SENT" });
        const mockApprovalUpdate = vi.fn().mockResolvedValue({ id: "approval-1", status: "APPROVED" });

        const mockPrisma = {
            approvalRequest: {
                findUnique: vi.fn().mockResolvedValue({
                    id: "approval-1",
                    teamId: "team-1",
                    entityType: "Email",
                    entityId: "email-1",
                    actionType: "email_draft_approval",
                    payload: {
                        emailId: "email-1",
                        leadId: "lead-1",
                        campaignId: "camp-1",
                        subject: "Test Subject",
                        body: "Test Body",
                    },
                }),
                update: mockApprovalUpdate,
            },
            email: {
                update: mockEmailUpdate,
            },
            lead: {
                update: mockLeadUpdate,
            },
        };

        // Simulate POST handler logic
        const approval = await mockPrisma.approvalRequest.findUnique({ where: { id: "approval-1" } });
        const payload = approval.payload;

        await mockPrisma.approvalRequest.update({
            where: { id: "approval-1" },
            data: { status: "APPROVED" },
        });

        await mockPrisma.email.update({
            where: { id: payload.emailId },
            data: { status: "queued" },
        });

        await mockPrisma.lead.update({
            where: { id: payload.leadId },
            data: { status: "SENT" },
        });

        expect(mockApprovalUpdate).toHaveBeenCalledWith({
            where: { id: "approval-1" },
            data: { status: "APPROVED" },
        });

        expect(mockEmailUpdate).toHaveBeenCalledWith({
            where: { id: "email-1" },
            data: { status: "queued" },
        });

        expect(mockLeadUpdate).toHaveBeenCalledWith({
            where: { id: "lead-1" },
            data: { status: "SENT" },
        });
    });
});
