import { prisma } from "@/lib/db";
import { logger } from "@/lib/logger";

export type LeadDataSourceInput = {
    leadId: string;
    field: string;
    source: "HUNTER" | "NETJANA" | "CSV_IMPORT" | "MANUAL";
    value: string;
    confidence?: "HIGH" | "MEDIUM" | "LOW" | "NONE";
};

// Best-effort provenance write - a failure here must never block or fail the
// caller's primary Lead write, so every error is swallowed after logging.
export async function recordLeadDataSource(input: LeadDataSourceInput): Promise<void> {
    try {
        await (prisma as any).leadDataSource.create({
            data: {
                leadId: input.leadId,
                field: input.field,
                source: input.source,
                value: input.value,
                confidence: input.confidence ?? null,
            },
        });
    } catch (error) {
        logger.warn("Failed to record LeadDataSource row", {
            leadId: input.leadId,
            field: input.field,
            source: input.source,
            error: error instanceof Error ? error.message : error,
        });
    }
}

export async function recordLeadDataSources(inputs: LeadDataSourceInput[]): Promise<void> {
    await Promise.all(inputs.map((input) => recordLeadDataSource(input)));
}
