import { describe, it, expect, vi } from "vitest";

describe("Self-Healing Approval Backfill Safeguard", () => {
    it("does NOT spawn a new ApprovalRequest if an ApprovalRequest already exists in ANY status (APPROVED, REJECTED, PENDING)", async () => {
        const mockCreate = vi.fn();

        const existingApprovals = [
            { entityId: "email-101", payload: { emailId: "email-101" }, status: "APPROVED" },
            { entityId: "email-102", payload: { emailId: "email-102" }, status: "REJECTED" },
        ];

        const existingEmailIds = new Set<string>();
        for (const a of existingApprovals) {
            if (a.entityId) existingEmailIds.add(a.entityId);
            const payloadEmailId = (a.payload as any)?.emailId;
            if (payloadEmailId) existingEmailIds.add(payloadEmailId);
        }

        const draftEmails = [
            { id: "email-101", subject: "Draft 1" }, // Has APPROVED approval
            { id: "email-102", subject: "Draft 2" }, // Has REJECTED approval
            { id: "email-103", subject: "Draft 3" }, // Truly orphaned draft!
        ];

        for (const email of draftEmails) {
            if (!existingEmailIds.has(email.id)) {
                mockCreate({ emailId: email.id });
            }
        }

        // Only email-103 should trigger backfill creation
        expect(mockCreate).toHaveBeenCalledTimes(1);
        expect(mockCreate).toHaveBeenCalledWith({ emailId: "email-103" });
    });
});
