import { prisma } from "@/lib/db";
import { AuditService } from "@/modules/audit/auditService";
import { ContentPostError } from "./contentPostService";
import { validateFlowSteps, type FlowStep } from "./dmFlowMachine";

// Team-scoped CRUD for Instagram DM flows (dmFlowMachine.ts runs them). Every query filters by
// teamId. A flow's steps are checked on save: the property keys must be active properties of the
// team, so an answer always has somewhere to go.

const NAME_MAX = 100;

const fail = (status: number, message: string): never => {
    throw new ContentPostError(status, message);
};

function checkName(name: unknown): string {
    const trimmed = typeof name === "string" ? name.trim() : "";
    if (!trimmed || trimmed.length > NAME_MAX) fail(400, `A flow needs a name of 1 to ${NAME_MAX} characters.`);
    return trimmed;
}

async function checkSteps(teamId: string, input: unknown): Promise<FlowStep[]> {
    const result = validateFlowSteps(input);
    if (!result.ok) fail(400, result.message);
    const keys = [...new Set(result.steps.flatMap((step) => (step.type === "question" ? [step.property] : [])))];
    if (keys.length > 0) {
        const found = await prisma.leadProperty.findMany({
            where: { teamId, archivedAt: null, key: { in: keys } },
            select: { key: true },
        });
        const known = new Set(found.map((row) => row.key));
        const missing = keys.filter((key) => !known.has(key));
        if (missing.length > 0) fail(400, `These custom properties don't exist: ${missing.join(", ")}. Create them in Settings first.`);
    }
    return result.steps;
}

export async function createDmFlow(teamId: string, userId: string, raw: { name: unknown; steps: unknown }) {
    const name = checkName(raw.name);
    const steps = await checkSteps(teamId, raw.steps);
    const flow = await prisma.dmFlow.create({
        data: { teamId, name, steps: steps as unknown as object, version: 1, createdById: userId },
    });
    await AuditService.log(teamId, userId, "DM_FLOW_CREATE", "DmFlow", flow.id, { name, steps: steps.length });
    return flow;
}

export async function updateDmFlow(teamId: string, userId: string, id: string, patch: { name?: unknown; steps?: unknown }) {
    const existing = await prisma.dmFlow.findFirst({ where: { id, teamId, archivedAt: null } });
    if (!existing) fail(404, "Flow not found");
    const data: Record<string, unknown> = { version: { increment: 1 } };
    if (patch.name !== undefined) data["name"] = checkName(patch.name);
    if (patch.steps !== undefined) data["steps"] = (await checkSteps(teamId, patch.steps)) as unknown as object;
    const updated = await prisma.dmFlow.update({ where: { id }, data });
    await AuditService.log(teamId, userId, "DM_FLOW_UPDATE", "DmFlow", id, { version: updated.version });
    return updated;
}

export async function archiveDmFlow(teamId: string, userId: string, id: string) {
    // Archived flows keep their runs; triggers pointing at them stop starting new runs.
    const done = await prisma.dmFlow.updateMany({ where: { id, teamId, archivedAt: null }, data: { archivedAt: new Date() } });
    if (done.count === 0) fail(404, "Flow not found");
    await AuditService.log(teamId, userId, "DM_FLOW_ARCHIVE", "DmFlow", id, {});
}

export async function listDmFlows(teamId: string) {
    return prisma.dmFlow.findMany({ where: { teamId, archivedAt: null }, orderBy: { createdAt: "asc" } });
}

/**
 * The flow a keyword trigger can start, or a 400/404. A flow with a link step needs the trigger to
 * have a landing page to link to.
 */
export async function getDmFlowForAttach(teamId: string, flowId: string, trigger: { landingPageId?: string | null } = {}) {
    const flow = await prisma.dmFlow.findFirst({ where: { id: flowId, teamId, archivedAt: null } });
    if (!flow) fail(404, "Flow not found");
    const steps = (flow as unknown as { steps: FlowStep[] }).steps;
    if (steps.some((step) => step.type === "link") && !trigger.landingPageId) {
        fail(400, "This flow sends a landing page link, so the auto-reply needs a published landing page.");
    }
    return flow;
}
