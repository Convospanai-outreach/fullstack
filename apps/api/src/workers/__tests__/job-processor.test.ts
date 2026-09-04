import { describe, expect, it, vi, beforeEach, Mock } from "vitest";
import { worker } from "../job-processor";
import { prisma } from "@/lib/db";
import { JobClaimLostError, JobQueue } from "@/lib/queue";
import { handleGmailHistorySync } from "../handlers/gmail-history-sync-worker";
import { executeCampaign } from "../handlers/campaign-worker";
import { GmailMailboxLeaseContendedError } from "@/modules/email-campaigner/service/googleMailboxService";
import { WorkflowService } from "@/lib/workflowService";
import { AuditService } from "@/modules/audit/auditService";
import { leadScoringService } from "@/modules/scoring/service/LeadScoringService";
import { exportService } from "@/modules/data-export/service/exportService";
import { crmService } from "@/modules/crm-integration/service/crmService";
import { webhookService } from "@/modules/webhooks/service/webhookService";
import { EventStore } from "@/modules/learning/EventStore";

vi.mock("@/lib/db", () => ({
    prisma: {
        job: {
            findFirst: vi.fn(),
        },
        crmIntegration: {
            findUnique: vi.fn(),
        },
        lead: {
            findMany: vi.fn(),
        },
    },
}));

vi.mock("@/lib/queue", () => ({
    JobClaimLostError: class JobClaimLostError extends Error {},
    JobQueue: {
        complete: vi.fn(),
        fail: vi.fn(),
        defer: vi.fn(),
        assertClaim: vi.fn(),
    },
}));

vi.mock("../handlers/gmail-history-sync-worker", () => ({
    handleGmailHistorySync: vi.fn(),
}));

vi.mock("../handlers/campaign-worker", () => ({
    executeCampaign: vi.fn(),
}));

vi.mock("@/lib/workflowService", () => ({
    WorkflowService: {
        processNode: vi.fn(),
    },
}));

vi.mock("@/modules/audit/auditService", () => ({
    AuditService: {
        log: vi.fn(),
    },
}));

vi.mock("@/modules/scoring/service/LeadScoringService", () => ({
    leadScoringService: {
        batchScoreLeads: vi.fn(),
    },
}));

vi.mock("@/modules/data-export/service/exportService", () => ({
    exportService: {
        generateCsv: vi.fn(),
    },
}));

vi.mock("@/modules/crm-integration/service/crmService", () => ({
    crmService: {
        syncLead: vi.fn(),
    },
}));

vi.mock("@/modules/webhooks/service/webhookService", () => ({
    webhookService: {
        processDelivery: vi.fn(),
    },
}));

vi.mock("@/modules/learning/EventStore", () => ({
    EventStore: {
        processEventJob: vi.fn(),
    },
}));

describe("job-processor", () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it("should dispatch INBOX_SYNC job to handleGmailHistorySync and complete successfully", async () => {
        const mockJob = {
            id: "job-1",
            status: "running",
            version: 2,
            type: "INBOX_SYNC",
            payload: {
                teamId: "t1",
                mailboxId: "m1",
                notificationHistoryId: "123",
            },
        };
        (prisma.job.findFirst as Mock).mockResolvedValueOnce(mockJob);
        (handleGmailHistorySync as Mock).mockResolvedValueOnce({
            mailboxId: "m1",
            synced: 10,
        });

        const result = await worker.performJob({ jobId: "job-1", version: 2 });

        expect(prisma.job.findFirst).toHaveBeenCalledWith({
            where: { id: "job-1", status: "running", version: 2 },
        });
        expect(JobQueue.assertClaim).toHaveBeenCalledWith("job-1", 2);
        expect(handleGmailHistorySync).toHaveBeenCalledWith(mockJob.payload);
        expect(JobQueue.complete).toHaveBeenCalledWith("job-1", 2, {
            mailboxId: "m1",
            synced: 10,
        });
        expect(result).toEqual({ mailboxId: "m1", synced: 10 });
    });

    it("should propagate handler failure and call JobQueue.fail", async () => {
        const mockJob = {
            id: "job-1",
            status: "running",
            version: 2,
            type: "INBOX_SYNC",
            payload: {
                teamId: "t1",
                mailboxId: "m1",
                notificationHistoryId: "123",
            },
        };
        (prisma.job.findFirst as Mock).mockResolvedValueOnce(mockJob);
        const syncError = new Error("Sync failed");
        (handleGmailHistorySync as Mock).mockRejectedValueOnce(syncError);

        await expect(worker.performJob({ jobId: "job-1", version: 2 })).rejects.toThrow("Sync failed");

        expect(JobQueue.fail).toHaveBeenCalledWith("job-1", 2, "Sync failed");
        expect(JobQueue.defer).not.toHaveBeenCalled();
    });

    it("defers lease contention without completing the job or consuming normal failure accounting", async () => {
        const mockJob = {
            id: "job-contended",
            status: "running",
            version: 4,
            type: "INBOX_SYNC",
            payload: {
                teamId: "t1",
                mailboxId: "m1",
                notificationHistoryId: "124",
            },
        };
        (prisma.job.findFirst as Mock).mockResolvedValueOnce(mockJob);
        (handleGmailHistorySync as Mock).mockRejectedValueOnce(new GmailMailboxLeaseContendedError("m1"));
        (JobQueue.defer as Mock).mockResolvedValueOnce({ id: mockJob.id, status: "queued" });
        const before = Date.now();

        const result = await worker.performJob({ jobId: mockJob.id, version: 4 });

        const after = Date.now();
        expect(result).toEqual({ deferred: true, reason: "MAILBOX_LEASE_CONTENDED" });
        expect(JobQueue.complete).not.toHaveBeenCalled();
        expect(JobQueue.fail).not.toHaveBeenCalled();
        expect(JobQueue.defer).toHaveBeenCalledWith(mockJob.id, 4, {
            processAt: expect.any(Date),
            reason: "MAILBOX_LEASE_CONTENDED",
        });
        const processAt = (JobQueue.defer as Mock).mock.calls[0][2].processAt as Date;
        expect(processAt.getTime()).toBeGreaterThanOrEqual(before + 15_000);
        expect(processAt.getTime()).toBeLessThanOrEqual(after + 45_000);
    });

    it("should retain existing behavior for other job types (e.g. campaign_execution)", async () => {
        const mockJob = {
            id: "job-2",
            status: "running",
            version: 3,
            type: "campaign_execution",
            payload: {
                campaignId: "c1",
                userId: "u1",
            },
        };
        (prisma.job.findFirst as Mock).mockResolvedValueOnce(mockJob);
        (executeCampaign as Mock).mockResolvedValueOnce({
            campaignId: "c1",
            leadsProcessed: 5,
        });

        const result = await worker.performJob({ jobId: "job-2", version: 3 });

        expect(executeCampaign).toHaveBeenCalledWith("c1", "u1", undefined);
        expect(JobQueue.complete).toHaveBeenCalledWith("job-2", 3, {
            campaignId: "c1",
            leadsProcessed: 5,
        });
        expect(result).toEqual({ campaignId: "c1", leadsProcessed: 5 });
    });

    it("never adopts a reloaded newer version when finalizing the original claim", async () => {
        const reloadedJob = {
            id: "job-1",
            status: "running",
            version: 99,
            type: "INBOX_SYNC",
            payload: { teamId: "t1", mailboxId: "m1", notificationHistoryId: "123" },
        };
        (prisma.job.findFirst as Mock).mockResolvedValueOnce(reloadedJob);
        (handleGmailHistorySync as Mock).mockResolvedValueOnce({ synced: 1 });

        await worker.performJob({ jobId: "job-1", version: 2 });

        expect(JobQueue.assertClaim).toHaveBeenCalledWith("job-1", 2);
        expect(JobQueue.complete).toHaveBeenCalledWith("job-1", 2, { synced: 1 });
        expect(JobQueue.complete).not.toHaveBeenCalledWith("job-1", 99, expect.anything());
    });

    it("stops before the business handler when the original running claim is gone", async () => {
        (prisma.job.findFirst as Mock).mockResolvedValueOnce(null);

        await expect(worker.performJob({ jobId: "job-lost", version: 2 })).rejects.toBeInstanceOf(Error);

        expect(handleGmailHistorySync).not.toHaveBeenCalled();
        expect(JobQueue.complete).not.toHaveBeenCalled();
        expect(JobQueue.fail).not.toHaveBeenCalled();
        expect(JobQueue.defer).not.toHaveBeenCalled();
    });

    it("does not fail or rerun a successful handler when completion persistence fails", async () => {
        const mockJob = {
            id: "job-complete-failure",
            status: "running",
            version: 5,
            type: "INBOX_SYNC",
            payload: { teamId: "t1", mailboxId: "m1", notificationHistoryId: "123" },
        };
        const completionError = new Error("completion persistence failed");
        (prisma.job.findFirst as Mock).mockResolvedValueOnce(mockJob);
        (handleGmailHistorySync as Mock).mockResolvedValueOnce({ synced: 1 });
        (JobQueue.complete as Mock).mockRejectedValueOnce(completionError);

        await expect(worker.performJob({ jobId: mockJob.id, version: 5 })).rejects.toBe(completionError);

        expect(handleGmailHistorySync).toHaveBeenCalledTimes(1);
        expect(JobQueue.complete).toHaveBeenCalledWith(mockJob.id, 5, { synced: 1 });
        expect(JobQueue.fail).not.toHaveBeenCalled();
    });

    it("dispatches workflow_step jobs with runId/nodeId to WorkflowService.processNode", async () => {
        const mockJob = {
            id: "job-wf-1",
            status: "running",
            version: 1,
            type: "workflow_step",
            payload: { runId: "run-1", nodeId: "node-1" },
        };
        (prisma.job.findFirst as Mock).mockResolvedValueOnce(mockJob);
        (WorkflowService.processNode as Mock).mockResolvedValueOnce({ nextNode: "node-2" });

        const result = await worker.performJob({ jobId: "job-wf-1", version: 1 });

        expect(WorkflowService.processNode).toHaveBeenCalledWith("run-1", "node-1");
        expect(result).toEqual({ nextNode: "node-2" });
    });

    it("dispatches outbox-relayed workflow_step jobs (eventType, no runId/nodeId) to an audit log instead of throwing", async () => {
        const mockJob = {
            id: "job-wf-2",
            status: "running",
            version: 1,
            type: "workflow_step",
            payload: { teamId: "t1", eventType: "PAYMENT_CAPTURED", paymentId: "pay_1" },
        };
        (prisma.job.findFirst as Mock).mockResolvedValueOnce(mockJob);

        const result = await worker.performJob({ jobId: "job-wf-2", version: 1 });

        expect(AuditService.log).toHaveBeenCalledWith(
            "t1",
            null,
            "PAYMENT_CAPTURED",
            "OutboxEvent",
            "pay_1",
            mockJob.payload
        );
        expect(result).toEqual({ acknowledged: true, eventType: "PAYMENT_CAPTURED" });
    });

    it("dispatches order_captured jobs to an audit log", async () => {
        const mockJob = {
            id: "job-order-1",
            status: "running",
            version: 1,
            type: "order_captured",
            payload: { teamId: "t1", orderId: "order_1", productId: "prod_1" },
        };
        (prisma.job.findFirst as Mock).mockResolvedValueOnce(mockJob);

        const result = await worker.performJob({ jobId: "job-order-1", version: 1 });

        expect(AuditService.log).toHaveBeenCalledWith(
            "t1",
            null,
            "ORDER_CAPTURED",
            "Order",
            "order_1",
            mockJob.payload
        );
        expect(result).toEqual({ acknowledged: true });
    });

    it("dispatches agent_stop jobs to an acknowledgement without throwing (OPEN-77 regression)", async () => {
        const mockJob = {
            id: "job-agent-stop-1",
            status: "running",
            version: 1,
            type: "agent_stop",
            payload: { agentId: "agent_1", userId: "user_1" },
        };
        (prisma.job.findFirst as Mock).mockResolvedValueOnce(mockJob);

        const result = await worker.performJob({ jobId: "job-agent-stop-1", version: 1 });

        expect(result).toEqual({ acknowledged: true, agentId: "agent_1" });
    });

    it("dispatches data_export jobs to exportService.generateCsv (OPEN-77 regression)", async () => {
        const mockJob = {
            id: "job-export-1",
            status: "running",
            version: 1,
            type: "data_export",
            payload: { teamId: "t1", entity: "leads" },
        };
        (prisma.job.findFirst as Mock).mockResolvedValueOnce(mockJob);
        (exportService.generateCsv as Mock).mockResolvedValueOnce("id,fullName\n1,Alice");

        const result = await worker.performJob({ jobId: "job-export-1", version: 1 });

        expect(exportService.generateCsv).toHaveBeenCalledWith("leads", "t1");
        expect(result).toEqual({ entity: "leads", format: "csv", csv: "id,fullName\n1,Alice" });
    });

    it("rejects data_export jobs for an unsupported entity type instead of silently no-oping", async () => {
        const mockJob = {
            id: "job-export-2",
            status: "running",
            version: 1,
            type: "data_export",
            payload: { teamId: "t1", entity: "invoices" },
        };
        (prisma.job.findFirst as Mock).mockResolvedValueOnce(mockJob);

        await expect(worker.performJob({ jobId: "job-export-2", version: 1 })).rejects.toThrow(
            'data_export does not support entity type "invoices"'
        );
    });

    it("dispatches CRM_SYNC jobs to crmService.syncLead per lead when HubSpot is configured (OPEN-77 regression)", async () => {
        const mockJob = {
            id: "job-crm-1",
            status: "running",
            version: 1,
            type: "CRM_SYNC",
            payload: { teamId: "t1", provider: "HUBSPOT" },
        };
        (prisma.job.findFirst as Mock).mockResolvedValueOnce(mockJob);
        (prisma.crmIntegration.findUnique as Mock).mockResolvedValueOnce({ isActive: true });
        (prisma.lead.findMany as Mock).mockResolvedValueOnce([{ id: "lead_1" }, { id: "lead_2" }]);
        (crmService.syncLead as Mock)
            .mockResolvedValueOnce({ status: "success", crmId: "hs_1" })
            .mockResolvedValueOnce({ status: "failed", details: "no email" });

        const result = await worker.performJob({ jobId: "job-crm-1", version: 1 });

        expect(crmService.syncLead).toHaveBeenCalledTimes(2);
        expect(crmService.syncLead).toHaveBeenCalledWith("lead_1", "t1");
        expect(crmService.syncLead).toHaveBeenCalledWith("lead_2", "t1");
        expect(result).toEqual({ syncedCount: 2, summary: { success: 1, failed: 1 } });
    });

    it("skips CRM_SYNC without calling syncLead when HubSpot isn't configured", async () => {
        const mockJob = {
            id: "job-crm-2",
            status: "running",
            version: 1,
            type: "CRM_SYNC",
            payload: { teamId: "t1", provider: "HUBSPOT" },
        };
        (prisma.job.findFirst as Mock).mockResolvedValueOnce(mockJob);
        (prisma.crmIntegration.findUnique as Mock).mockResolvedValueOnce(null);

        const result = await worker.performJob({ jobId: "job-crm-2", version: 1 });

        expect(crmService.syncLead).not.toHaveBeenCalled();
        expect(result).toEqual({ syncedCount: 0, skipped: "HubSpot not configured or inactive" });
    });

    it("dispatches WEBHOOK_DISPATCH jobs to webhookService.processDelivery (OPEN-77 regression)", async () => {
        const mockJob = {
            id: "job-webhook-1",
            status: "running",
            version: 1,
            type: "WEBHOOK_DISPATCH",
            payload: { webhookId: "wh_1", event: "lead.created", payload: { leadId: "lead_1" } },
        };
        (prisma.job.findFirst as Mock).mockResolvedValueOnce(mockJob);
        (webhookService.processDelivery as Mock).mockResolvedValueOnce({ delivered: true });

        const result = await worker.performJob({ jobId: "job-webhook-1", version: 1 });

        expect(webhookService.processDelivery).toHaveBeenCalledWith("wh_1", "lead.created", { leadId: "lead_1" }, undefined);
        expect(result).toEqual({ delivered: true });
    });

    it("passes payload.teamId through to webhookService.processDelivery so it can scope the webhook lookup", async () => {
        const mockJob = {
            id: "job-webhook-2",
            status: "running",
            version: 1,
            type: "WEBHOOK_DISPATCH",
            payload: { webhookId: "wh_2", event: "lead.created", payload: { leadId: "lead_2" }, teamId: "team-a" },
        };
        (prisma.job.findFirst as Mock).mockResolvedValueOnce(mockJob);
        (webhookService.processDelivery as Mock).mockResolvedValueOnce({ delivered: true });

        await worker.performJob({ jobId: "job-webhook-2", version: 1 });

        expect(webhookService.processDelivery).toHaveBeenCalledWith(
            "wh_2",
            "lead.created",
            { leadId: "lead_2" },
            "team-a"
        );
    });

    it("dispatches event_processing jobs with an eventId to EventStore.processEventJob (OPEN-77 regression)", async () => {
        const mockJob = {
            id: "job-event-1",
            status: "running",
            version: 1,
            type: "event_processing",
            payload: { eventId: "evt_1", teamId: "t1" },
        };
        (prisma.job.findFirst as Mock).mockResolvedValueOnce(mockJob);
        (EventStore.processEventJob as Mock).mockResolvedValueOnce(undefined);

        const result = await worker.performJob({ jobId: "job-event-1", version: 1 });

        expect(EventStore.processEventJob).toHaveBeenCalledWith("evt_1");
        expect(result).toEqual({ acknowledged: true, eventId: "evt_1" });
    });

    it("falls back event_processing without an eventId to an audit log (outbox generic-event path)", async () => {
        const mockJob = {
            id: "job-event-2",
            status: "running",
            version: 1,
            type: "event_processing",
            payload: { teamId: "t1", eventType: "SOME_UNMAPPED_EVENT", aggregateId: "agg_1" },
        };
        (prisma.job.findFirst as Mock).mockResolvedValueOnce(mockJob);

        const result = await worker.performJob({ jobId: "job-event-2", version: 1 });

        expect(EventStore.processEventJob).not.toHaveBeenCalled();
        expect(AuditService.log).toHaveBeenCalledWith(
            "t1",
            null,
            "SOME_UNMAPPED_EVENT",
            "OutboxEvent",
            "agg_1",
            mockJob.payload
        );
        expect(result).toEqual({ acknowledged: true, eventType: "SOME_UNMAPPED_EVENT" });
    });

    it("dispatches lead_scoring jobs to the leadScoringService instance, not the class (OPEN-75 regression)", async () => {
        const mockJob = {
            id: "job-scoring-1",
            status: "running",
            version: 1,
            type: "lead_scoring",
            payload: { teamId: "t1" },
        };
        (prisma.job.findFirst as Mock).mockResolvedValueOnce(mockJob);
        (leadScoringService.batchScoreLeads as Mock).mockResolvedValueOnce({
            totalProcessed: 3,
            successful: 3,
            failed: 0,
            averageScore: 0.5,
            tierDistribution: { hot: 1, warm: 1, cold: 1 },
            errors: [],
        });

        const result = await worker.performJob({ jobId: "job-scoring-1", version: 1 });

        expect(leadScoringService.batchScoreLeads).toHaveBeenCalledWith("t1");
        expect(result).toEqual(
            expect.objectContaining({ totalProcessed: 3, successful: 3 })
        );
    });

    it("propagates a completion claim-loss outcome without calling fail", async () => {
        const mockJob = {
            id: "job-complete-lost",
            status: "running",
            version: 5,
            type: "INBOX_SYNC",
            payload: { teamId: "t1", mailboxId: "m1", notificationHistoryId: "123" },
        };
        (prisma.job.findFirst as Mock).mockResolvedValueOnce(mockJob);
        (handleGmailHistorySync as Mock).mockResolvedValueOnce({ synced: 1 });
        (JobQueue.complete as Mock).mockRejectedValueOnce(new JobClaimLostError());

        await expect(worker.performJob({ jobId: mockJob.id, version: 5 })).rejects.toBeInstanceOf(JobClaimLostError);

        expect(handleGmailHistorySync).toHaveBeenCalledTimes(1);
        expect(JobQueue.fail).not.toHaveBeenCalled();
    });
});
