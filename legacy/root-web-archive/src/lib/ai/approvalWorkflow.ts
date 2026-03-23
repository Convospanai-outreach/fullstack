import { prisma } from "@/lib/db";

export type ApprovalStatus = "PENDING" | "APPROVED" | "REJECTED";

export class ApprovalWorkflow {
    /**
     * Queues an AI-generated draft for manual human review.
     */
    static async queueForReview(automationId: string, input: any, output: any, metadata: any = {}) {
        return await prisma.automationLog.create({
            data: {
                automationId,
                status: "pending_approval",
                input: JSON.stringify(input),
                output: JSON.stringify(output),
                metadata: JSON.stringify(metadata)
            }
        });
    }

    /**
     * Approves or Rejects a pending draft, potentially with manual overrides.
     */
    static async handleApproval(logId: string, status: "APPROVED" | "REJECTED", overrideOutput?: any) {
        const log = await prisma.automationLog.findUnique({
            where: { id: logId }
        });

        if (!log || log.status !== "pending_approval") {
            throw new Error("Invalid or already processed log entry.");
        }

        const finalOutput = overrideOutput || JSON.parse(log.output as string);

        await prisma.automationLog.update({
            where: { id: logId },
            data: {
                status: status === "APPROVED" ? "success" : "rejected",
                output: JSON.stringify(finalOutput)
            }
        });

        return finalOutput;
    }
}
