import { prisma } from "@/lib/db";
import { TOKENS_HELD_STATUS } from "./sequenceService";
import type { MissingToken } from "./messageTokens";

// Emails held because a merge field could not be filled for the contact (see messageTokens.ts). Team scoped.
export interface HeldEmail {
    runId: string;
    leadId: string;
    leadName: string | null;
    email: string | null;
    company: string | null;
    campaignName: string | null;
    sequenceName: string | null;
    subject: string | null;
    heldAt: string | null;
    missing: MissingToken[];
    // True when every missing field has a suggested fallback, so the sender can approve sending.
    canApprove: boolean;
}

function parseMissing(raw: string | null): MissingToken[] {
    try {
        const parsed = JSON.parse(raw || "{}");
        return Array.isArray(parsed?.missing) ? parsed.missing : [];
    } catch {
        return [];
    }
}

export async function listHeldEmails(teamId: string, limit = 200): Promise<HeldEmail[]> {
    const runs = await prisma.sequenceStepRun.findMany({
        where: { teamId, status: TOKENS_HELD_STATUS },
        include: {
            step: { select: { subject: true } },
            lead: { select: { id: true, fullName: true, email: true, company: true } },
            enrollment: { select: { campaign: { select: { name: true } }, sequence: { select: { name: true } } } },
        },
        orderBy: { completedAt: "desc" },
        take: Math.min(Math.max(limit, 1), 200),
    });

    return runs.map((run: any) => {
        const missing = parseMissing(run.errorMessage);
        return {
            runId: run.id,
            leadId: run.leadId,
            leadName: run.lead?.fullName ?? null,
            email: run.lead?.email ?? null,
            company: run.lead?.company ?? null,
            campaignName: run.enrollment?.campaign?.name ?? null,
            sequenceName: run.enrollment?.sequence?.name ?? null,
            subject: run.step?.subject ?? null,
            heldAt: run.completedAt ? new Date(run.completedAt).toISOString() : null,
            missing,
            canApprove: missing.length > 0 && missing.every((m) => m.reason === "empty" && m.suggestedFallback !== null),
        };
    });
}
