import { prisma } from "@/lib/db";
import { JobQueue, JobPayload } from "@/lib/queue";
import { evaluateSequenceCondition } from "@/lib/campaigns/sequenceCondition";

function normalizedStepType(stepType: string): string {
  return stepType.trim().toLowerCase().replace(/-/g, "_");
}

// Follows this sequence's SequenceEdge graph from currentStep to find what runs next. `handle`
// ("yes"/"no") only applies right after a CONDITION step; every other step type (and a condition
// outcome with no matching branch configured) uses the "default" edge. A sequence with zero edges
// at all falls back to legacy stepOrder traversal - mirrors resolveNextStep() in apps/api's
// sequenceService.ts, since either engine may advance the same enrollment.
async function resolveNextStep(sequenceId: string, currentStep: { id: string; stepOrder: number }, handle?: "yes" | "no") {
  const hasAnyEdges = (await prisma.sequenceEdge.count({ where: { sequenceId } })) > 0;
  if (!hasAnyEdges) {
    return prisma.sequenceStep.findFirst({
      where: { sequenceId, status: "ACTIVE", stepOrder: { gt: currentStep.stepOrder } },
      orderBy: { stepOrder: "asc" },
    });
  }

  let fromStepId = currentStep.id;
  let preferredHandle = handle;
  for (let hop = 0; hop < 50; hop++) {
    const edge =
      (preferredHandle && (await prisma.sequenceEdge.findFirst({ where: { sourceStepId: fromStepId, sourceHandle: preferredHandle } }))) ||
      (await prisma.sequenceEdge.findFirst({ where: { sourceStepId: fromStepId, sourceHandle: "default" } }));
    if (!edge) return null;
    const step = await prisma.sequenceStep.findUnique({ where: { id: edge.targetStepId } });
    if (!step) return null;
    if (step.status === "ACTIVE") return step;
    fromStepId = step.id;
    preferredHandle = undefined;
  }
  return null;
}

export async function handleSequenceStep(payload: JobPayload) {
  const { enrollmentId, sequenceStepId, teamId, leadId } = payload;

  if (!enrollmentId || !sequenceStepId || !teamId || !leadId) {
    throw new Error("sequence_step: enrollmentId, sequenceStepId, teamId, leadId are required");
  }

  const run = await prisma.sequenceStepRun.findFirst({
    where: { enrollmentId, sequenceStepId },
  });
  if (!run) {
    throw new Error(`SequenceStepRun not found for enrollment ${enrollmentId} step ${sequenceStepId}`);
  }

  await prisma.sequenceStepRun.update({
    where: { id: run.id },
    data: { startedAt: new Date(), status: "PROCESSING" },
  });

  const step = await prisma.sequenceStep.findUnique({ where: { id: sequenceStepId } });
  if (!step) {
    throw new Error(`SequenceStep ${sequenceStepId} not found`);
  }

  const type = normalizedStepType(step.stepType);
  let handle: "yes" | "no" | undefined;
  let runStatus = "COMPLETED";

  if (type === "email") {
    await JobQueue.enqueue("email_sending", {
      leadId,
      teamId,
      campaignId: run.campaignId || undefined,
      mailboxId: run.mailboxId || undefined,
      subject: step.subject || undefined,
      body: step.body || undefined,
    });
  } else if (type === "condition") {
    const lead = await prisma.lead.findUnique({ where: { id: leadId } });
    const passed = evaluateSequenceCondition(step, lead || {});
    handle = passed ? "yes" : "no";
    runStatus = passed ? "COMPLETED" : "SKIPPED_CONDITION";
  } else if (type === "delay") {
    // No action - the delay is expressed by the next step's delayDays/delayHours, applied below.
  } else if (type === "manual_review") {
    await prisma.sequenceStepRun.update({
      where: { id: run.id },
      data: { completedAt: new Date(), status: "AWAITING_MANUAL_REVIEW" },
    });
    await prisma.sequenceEnrollment.update({
      where: { id: enrollmentId },
      data: { status: "MANUAL_REVIEW", lastRunAt: new Date(), nextRunAt: null },
    });
    return { stepId: sequenceStepId, status: "AWAITING_MANUAL_REVIEW" };
  } else {
    throw new Error(`Unsupported sequence step type: ${step.stepType}`);
  }

  await prisma.sequenceStepRun.update({
    where: { id: run.id },
    data: { completedAt: new Date(), status: runStatus },
  });

  const nextStep = await resolveNextStep(step.sequenceId, step, handle);

  if (nextStep) {
    const nextRunAt = new Date(Date.now() + nextStep.delayDays * 86400000 + nextStep.delayHours * 3600000);
    await prisma.sequenceEnrollment.update({
      where: { id: enrollmentId },
      data: { currentStepOrder: step.stepOrder, nextRunAt },
    });
  } else {
    await prisma.sequenceEnrollment.update({
      where: { id: enrollmentId },
      data: { status: "COMPLETED", completedAt: new Date() },
    });
  }

  return { stepId: sequenceStepId, status: runStatus };
}
