import { prisma } from "@/lib/db";
import { logger } from "@/lib/logger";
import { JobQueue, JobPayload } from "@/lib/queue";

export async function handleSequenceStep(payload: JobPayload) {
  const { enrollmentId, sequenceStepId, teamId, leadId } = payload;

  if (!enrollmentId || !sequenceStepId || !teamId || !leadId) {
    throw new Error("sequence_step: enrollmentId, sequenceStepId, teamId, leadId are required");
  }

  // 2. Load SequenceStepRun
  const run = await prisma.sequenceStepRun.findFirst({
    where: { enrollmentId, sequenceStepId }
  });

  if (!run) {
    throw new Error(`SequenceStepRun not found for enrollment ${enrollmentId} step ${sequenceStepId}`);
  }

  // 3. Mark run as PROCESSING
  await prisma.sequenceStepRun.update({
    where: { id: run.id },
    data: { startedAt: new Date(), status: "PROCESSING" }
  });

  // 4. Load the SequenceStep to get stepType
  const step = await prisma.sequenceStep.findUnique({
    where: { id: sequenceStepId }
  });

  if (!step) {
    throw new Error(`SequenceStep ${sequenceStepId} not found`);
  }

  // 5. If EMAIL -> enqueue email_sending job
  if (step.stepType === "EMAIL") {
    await JobQueue.enqueue("email_sending", {
      leadId,
      teamId,
      mailboxId: run.mailboxId || undefined,
    });
  }

  // 6. Mark run as COMPLETED
  await prisma.sequenceStepRun.update({
    where: { id: run.id },
    data: { completedAt: new Date(), status: "COMPLETED" }
  });

  // 7. Advance enrollment
  const nextStep = await prisma.sequenceStep.findFirst({
    where: { sequenceId: step.sequenceId, stepOrder: { >: step.stepOrder } },
    orderBy: { stepOrder: 'asc' }
  });

  if (nextStep) {
    const nextRunAt = new Date(Date.now() + nextStep.delayDays * 86400000 + nextStep.delayHours * 3600000);
    await prisma.sequenceEnrollment.update({
      where: { id: enrollmentId },
      data: { currentStepOrder: nextStep.stepOrder, nextRunAt }
    });
  } else {
    // End of sequence
    await prisma.sequenceEnrollment.update({
      where: { id: enrollmentId },
      data: { status: "COMPLETED", completedAt: new Date() }
    });
  }

  return { stepId: sequenceStepId, status: "COMPLETED" };
}
