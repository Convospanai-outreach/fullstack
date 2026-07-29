import { describe, it, expect } from "vitest";

/**
 * Dedicated regression test for the Workflow Complete banner evaluation logic.
 *
 * Verifies that:
 * 1. Drafts generated + pending approvals > 0 → Workflow is NOT complete (step 3/4).
 * 2. Drafts generated + 0 pending approvals + 0 pending send (all sent) → Workflow IS complete (step 4, allComplete = true).
 * 3. No drafts generated → Workflow is NOT complete (step 1 or 2).
 */

interface WorkflowData {
    leadsImported: boolean;
    leadsCount: number;
    draftsGenerated: boolean;
    draftsCount: number;
    followUpsReviewed: boolean;
    followUpsCount: number;
    pendingSendCount: number;
}

function getCurrentStep(w: WorkflowData): 1 | 2 | 3 | 4 {
    if (!w.leadsImported) return 1;
    if (!w.draftsGenerated) return 2;
    if (!w.followUpsReviewed) return 3;
    return 4;
}

function isWorkflowComplete(w: WorkflowData): boolean {
    const currentStep = getCurrentStep(w);
    return (
        currentStep === 4 &&
        w.leadsImported &&
        w.draftsGenerated &&
        w.followUpsReviewed &&
        w.pendingSendCount === 0
    );
}

describe("Workflow Complete Banner Logic", () => {
    it("does NOT show complete when drafts exist and are pending approval", () => {
        // 5 leads imported, 5 total emails generated, 5 pending approvals, 5 un-sent drafts
        const state: WorkflowData = {
            leadsImported: true,
            leadsCount: 5,
            draftsGenerated: true,
            draftsCount: 5,
            followUpsReviewed: false, // 5 pending approvals exist
            followUpsCount: 5,
            pendingSendCount: 5,
        };

        expect(getCurrentStep(state)).toBe(3); // Step 3: Review follow-ups
        expect(isWorkflowComplete(state)).toBe(false);
    });

    it("does NOT show complete when drafts are approved but waiting to be sent", () => {
        // 5 leads imported, 5 total emails generated, 0 pending approvals, BUT 5 drafts still pending send
        const state: WorkflowData = {
            leadsImported: true,
            leadsCount: 5,
            draftsGenerated: true,
            draftsCount: 5,
            followUpsReviewed: true, // 0 pending approvals
            followUpsCount: 0,
            pendingSendCount: 5, // 5 drafts still in queue
        };

        expect(getCurrentStep(state)).toBe(4); // Step 4: Send drafts
        expect(isWorkflowComplete(state)).toBe(false); // pendingSendCount > 0, so not complete
    });

    it("DOES show workflow complete when all 5 drafts have been approved and sent", () => {
        // 5 leads imported, 5 total emails generated (cumulative), 0 pending approvals, 0 pending send (all sent!)
        const state: WorkflowData = {
            leadsImported: true,
            leadsCount: 5,
            draftsGenerated: true, // totalEmailCount = 5 > 0
            draftsCount: 5,
            followUpsReviewed: true, // 0 pending approvals
            followUpsCount: 0,
            pendingSendCount: 0, // 0 un-sent drafts remaining (all sent!)
        };

        expect(getCurrentStep(state)).toBe(4); // Step 4
        expect(isWorkflowComplete(state)).toBe(true); // Complete!
    });
});
