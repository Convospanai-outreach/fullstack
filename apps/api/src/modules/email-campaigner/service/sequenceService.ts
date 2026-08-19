import { prisma } from "@/lib/db";
import { emailService } from "@/modules/email-campaigner";
import { assertMailboxCanSend, isSuppressed } from "./googleMailboxService";

const RUN_DUE_STATUSES = ["SCHEDULED", "RETRY_SCHEDULED"];
const RUN_SUCCESS_STATUSES = ["SENT", "COMPLETED", "AWAITING_MANUAL_REVIEW", "SKIPPED_CONDITION"];
const STOP_LEAD_STATUSES = new Set(["replied", "bounced", "unsubscribed", "do_not_contact", "meeting_booked"]);
const STOP_PIPELINE_STATES = new Set(["MEETING_BOOKED", "MEETING_CONFIRMED", "BOUNCED", "UNSUBSCRIBED"]);

type SequencePrisma = {
    campaignSequence: any;
    sequenceStep: any;
    sequenceEnrollment: any;
    sequenceStepRun: any;
    lead: any;
    email: any;
};

type ProcessDueOptions = {
    teamId?: string;
    limit?: number;
    now?: Date;
};

type ExecuteRunOptions = {
    runId: string;
    now?: Date;
};

type ConditionConfig = {
    leadStatusIn?: string[];
    leadStatusNotIn?: string[];
    pipelineStateIn?: string[];
    pipelineStateNotIn?: string[];
    hasEmail?: boolean;
};

function db(): SequencePrisma {
    const client = prisma as any;
    const missing = ["campaignSequence", "sequenceStep", "sequenceEnrollment", "sequenceStepRun"]
        .filter((delegate) => !client[delegate]);
    if (missing.length > 0) {
        throw new Error(`Sequence Prisma models are unavailable. Run Prisma generate after adding: ${missing.join(", ")}`);
    }
    return client as SequencePrisma;
}

function normalize(value: unknown) {
    return typeof value === "string" ? value.trim().toLowerCase() : "";
}

function retryAtForMailbox(reason?: string, now = new Date()) {
    const throttleMatch = reason?.match(/until\s+([0-9T:.\-Z]+)/i);
    if (throttleMatch?.[1]) {
        const parsed = new Date(throttleMatch[1]);
        if (!Number.isNaN(parsed.getTime()) && parsed > now) return parsed;
    }

    const tomorrow = new Date(now);
    tomorrow.setUTCDate(tomorrow.getUTCDate() + 1);
    tomorrow.setUTCHours(0, 5, 0, 0);
    return tomorrow;
}

function delayMs(step: any) {
    const days = Number.isFinite(step?.delayDays) ? step.delayDays : 0;
    const hours = Number.isFinite(step?.delayHours) ? step.delayHours : 0;
    return ((days * 24) + hours) * 60 * 60 * 1000;
}

function safeJsonObject(value: string | null | undefined): ConditionConfig {
    if (!value) return {};
    try {
        const parsed = JSON.parse(value);
        return parsed && typeof parsed === "object" ? parsed : {};
    } catch {
        return {};
    }
}

function conditionPasses(step: any, lead: any) {
    const config = safeJsonObject(step?.body);
    const status = normalize(lead?.status);
    const pipelineState = normalize(lead?.pipelineState);

    if (config.hasEmail === true && !lead?.email) return false;
    if (config.hasEmail === false && lead?.email) return false;
    if (config.leadStatusIn?.length && !config.leadStatusIn.map(normalize).includes(status)) return false;
    if (config.leadStatusNotIn?.map(normalize).includes(status)) return false;
    if (config.pipelineStateIn?.length && !config.pipelineStateIn.map(normalize).includes(pipelineState)) return false;
    if (config.pipelineStateNotIn?.map(normalize).includes(pipelineState)) return false;

    return true;
}

function exitReason(lead: any) {
    const status = normalize(lead?.status);
    const pipelineState = normalize(lead?.pipelineState).toUpperCase();
    if (lead?.repliedAt || status === "replied") return "replied";
    if (lead?.bouncedAt || status === "bounced") return "bounced";
    if (lead?.unsubscribedAt || status === "unsubscribed") return "unsubscribed";
    if (status === "do_not_contact") return "do_not_contact";
    if (status === "meeting_booked" || STOP_PIPELINE_STATES.has(pipelineState)) return "meeting_booked";
    if (STOP_LEAD_STATUSES.has(status)) return status;
    return null;
}

function stepType(step: any) {
    return normalize(step?.stepType).replace(/-/g, "_");
}

export class SequenceService {
    static async processDue(options: ProcessDueOptions = {}) {
        const client = db();
        const now = options.now ?? new Date();
        const limit = Math.min(Math.max(options.limit ?? 25, 1), 100);

        await this.seedDueEnrollmentRuns({ ...options, limit, now });

        const candidates = await client.sequenceStepRun.findMany({
            where: {
                ...(options.teamId ? { teamId: options.teamId } : {}),
                status: { in: RUN_DUE_STATUSES },
                scheduledAt: { lte: now },
            },
            orderBy: [{ scheduledAt: "asc" }, { createdAt: "asc" }],
            take: limit,
        });

        const results = [];
        for (const candidate of candidates) {
            const claimed = await this.claimRun(candidate.id, now);
            if (!claimed) continue;
            results.push(await this.executeRun({ runId: candidate.id, now }));
        }

        return { processed: results.length, results };
    }

    static async executeRun(options: ExecuteRunOptions) {
        const client = db();
        const now = options.now ?? new Date();
        const run = await client.sequenceStepRun.findUnique({
            where: { id: options.runId },
            include: {
                step: true,
                enrollment: { include: { lead: true, sequence: true, campaign: { select: { ownerId: true } } } },
            },
        });

        if (!run) throw new Error(`Sequence step run ${options.runId} not found`);
        if (!run.teamId || !run.leadId) {
            await this.failRun(run.id, "VALIDATION_ERROR", "Sequence sends require teamId and leadId.", false, now);
            return { runId: run.id, status: "FAILED", errorCode: "VALIDATION_ERROR" };
        }

        const lead = run.enrollment?.lead || await client.lead.findUnique({ where: { id: run.leadId } });
        const reason = exitReason(lead);
        if (reason) {
            await this.exitEnrollment(run, `EXIT_${reason.toUpperCase()}`, now);
            return { runId: run.id, status: "SKIPPED_EXITED", reason };
        }

        const type = stepType(run.step);
        if (type === "manual_review") {
            await client.sequenceStepRun.update({
                where: { id: run.id },
                data: { status: "AWAITING_MANUAL_REVIEW", completedAt: now },
            });
            await client.sequenceEnrollment.update({
                where: { id: run.enrollmentId },
                data: { status: "MANUAL_REVIEW", lastRunAt: now, nextRunAt: null },
            });
            return { runId: run.id, status: "AWAITING_MANUAL_REVIEW" };
        }

        if (type === "condition") {
            const passed = conditionPasses(run.step, lead);
            await client.sequenceStepRun.update({
                where: { id: run.id },
                data: { status: passed ? "COMPLETED" : "SKIPPED_CONDITION", completedAt: now },
            });
            await this.scheduleNextStep(run, now);
            return { runId: run.id, status: passed ? "COMPLETED" : "SKIPPED_CONDITION" };
        }

        if (type === "delay") {
            await client.sequenceStepRun.update({
                where: { id: run.id },
                data: { status: "COMPLETED", completedAt: now },
            });
            await this.scheduleNextStep(run, now);
            return { runId: run.id, status: "COMPLETED" };
        }

        if (type !== "email") {
            await this.failRun(run.id, "UNSUPPORTED_STEP_TYPE", `Unsupported sequence step type: ${run.step?.stepType}`, false, now);
            return { runId: run.id, status: "FAILED", errorCode: "UNSUPPORTED_STEP_TYPE" };
        }

        return this.executeEmailRun(run, lead, now);
    }

    private static async seedDueEnrollmentRuns(options: Required<Pick<ProcessDueOptions, "limit" | "now">> & Pick<ProcessDueOptions, "teamId">) {
        const client = db();
        const enrollments = await client.sequenceEnrollment.findMany({
            where: {
                ...(options.teamId ? { teamId: options.teamId } : {}),
                status: "ACTIVE",
                nextRunAt: { lte: options.now },
            },
            include: {
                lead: true,
                sequence: { include: { steps: { where: { status: "ACTIVE" }, orderBy: { stepOrder: "asc" } } } },
            },
            orderBy: [{ nextRunAt: "asc" }, { createdAt: "asc" }],
            take: options.limit,
        });

        for (const enrollment of enrollments) {
            const claimed = await client.sequenceEnrollment.updateMany({
                where: { id: enrollment.id, status: "ACTIVE", nextRunAt: enrollment.nextRunAt },
                data: { status: "SCHEDULING", nextRunAt: null },
            });
            if (claimed.count === 0) continue;

            const reason = exitReason(enrollment.lead);
            if (reason) {
                await client.sequenceEnrollment.update({
                    where: { id: enrollment.id },
                    data: { status: "EXITED", completedAt: options.now, cancelledAt: options.now },
                });
                continue;
            }

            const step = enrollment.sequence?.steps?.find((candidate: any) => candidate.stepOrder > enrollment.currentStepOrder);
            if (!step) {
                await client.sequenceEnrollment.update({
                    where: { id: enrollment.id },
                    data: { status: "COMPLETED", completedAt: options.now },
                });
                continue;
            }

            const existing = await client.sequenceStepRun.findFirst({
                where: {
                    enrollmentId: enrollment.id,
                    sequenceStepId: step.id,
                    status: { in: [...RUN_DUE_STATUSES, "RUNNING", ...RUN_SUCCESS_STATUSES] },
                },
            });

            if (!existing) {
                await client.sequenceStepRun.create({
                    data: {
                        teamId: enrollment.teamId,
                        enrollmentId: enrollment.id,
                        sequenceStepId: step.id,
                        mailboxId: enrollment.mailboxId,
                        leadId: enrollment.leadId,
                        campaignId: enrollment.campaignId,
                        status: "SCHEDULED",
                        scheduledAt: options.now,
                    },
                });
            }

            await client.sequenceEnrollment.update({
                where: { id: enrollment.id },
                data: { status: "ACTIVE" },
            });
        }
    }

    private static async claimRun(runId: string, now: Date) {
        const result = await db().sequenceStepRun.updateMany({
            where: { id: runId, status: { in: RUN_DUE_STATUSES }, scheduledAt: { lte: now } },
            data: { status: "RUNNING", startedAt: now, attemptCount: { increment: 1 } },
        });
        return result.count === 1;
    }

    private static async executeEmailRun(run: any, lead: any, now: Date) {
        const client = db();
        if (!lead?.email) {
            await this.failRun(run.id, "MISSING_EMAIL", "Lead has no email address.", false, now);
            return { runId: run.id, status: "FAILED", errorCode: "MISSING_EMAIL" };
        }

        const duplicateSuccess = await client.sequenceStepRun.findFirst({
            where: {
                id: { not: run.id },
                enrollmentId: run.enrollmentId,
                sequenceStepId: run.sequenceStepId,
                status: { in: ["SENT", "COMPLETED"] },
                OR: [{ emailId: { not: null } }, { providerMessageId: { not: null } }],
            },
        });
        if (duplicateSuccess) {
            await client.sequenceStepRun.update({
                where: { id: run.id },
                data: { status: "SKIPPED_DUPLICATE", completedAt: now, errorCode: "DUPLICATE_SUCCESS" },
            });
            await this.scheduleNextStep(run, now);
            return { runId: run.id, status: "SKIPPED_DUPLICATE" };
        }

        if (await isSuppressed(run.teamId, lead.email)) {
            await client.sequenceStepRun.update({
                where: { id: run.id },
                data: { status: "SKIPPED_SUPPRESSED", completedAt: now, errorCode: "SUPPRESSED" },
            });
            await client.sequenceEnrollment.update({
                where: { id: run.enrollmentId },
                data: { status: "EXITED", completedAt: now, cancelledAt: now },
            });
            return { runId: run.id, status: "SKIPPED_SUPPRESSED" };
        }

        if (run.mailboxId) {
            const mailboxCheck = await assertMailboxCanSend(run.teamId, run.mailboxId);
            if (!mailboxCheck.ok) {
                const retryAt = retryAtForMailbox(mailboxCheck.reason, now);
                await client.sequenceStepRun.update({
                    where: { id: run.id },
                    data: {
                        status: "RETRY_SCHEDULED",
                        scheduledAt: retryAt,
                        errorCode: "MAILBOX_NOT_READY",
                        errorMessage: mailboxCheck.reason,
                    },
                });
                return { runId: run.id, status: "RETRY_SCHEDULED", retryAt };
            }
        }

        const subject = typeof run.step?.subject === "string" && run.step.subject.trim()
            ? run.step.subject.trim()
            : "Following up";
        const body = typeof run.step?.body === "string" && run.step.body.trim()
            ? run.step.body
            : "";
        if (!body) {
            await this.failRun(run.id, "MISSING_BODY", "Email sequence step has no body.", false, now);
            return { runId: run.id, status: "FAILED", errorCode: "MISSING_BODY" };
        }

        const result = await emailService.sendEmail(lead.email, subject, body, {
            teamId: run.teamId,
            leadId: run.leadId,
            campaignId: run.campaignId,
            userId: run.enrollment?.campaign?.ownerId,
        });

        if (!result.success) {
            const retryable = this.isRetryableEmailError(result.error);
            await this.failRun(run.id, retryable ? "EMAIL_RETRYABLE" : "EMAIL_SEND_FAILED", result.error || "Email send failed.", retryable, now);
            return { runId: run.id, status: retryable ? "RETRY_SCHEDULED" : "FAILED" };
        }

        const email = result.providerId
            ? await client.email.findFirst({ where: { providerId: result.providerId, leadId: run.leadId } })
            : await client.email.findFirst({ where: { leadId: run.leadId, campaignId: run.campaignId }, orderBy: { createdAt: "desc" } });

        await client.sequenceStepRun.update({
            where: { id: run.id },
            data: {
                status: "SENT",
                completedAt: now,
                providerMessageId: result.providerId,
                emailId: email?.id,
                errorCode: null,
                errorMessage: null,
            },
        });

        try {
            const { OutboxService } = await import("@/lib/outboxService");
            await OutboxService.publishEvent({
                teamId: run.teamId,
                eventType: "SEQUENCE_STEP_COMPLETED",
                aggregateType: "SequenceStepRun",
                aggregateId: run.id,
                payload: {
                    enrollmentId: run.enrollmentId,
                    sequenceId: run.enrollment?.sequenceId,
                    leadId: run.leadId,
                    providerId: result.providerId,
                },
                idempotencyKey: `sequence_step_run_${run.id}_completed`,
            });
        } catch {
            // Outbox event emission is resilient
        }

        await this.scheduleNextStep(run, now);
        return { runId: run.id, status: "SENT", providerMessageId: result.providerId };
    }

    private static isRetryableEmailError(error?: string) {
        const normalized = normalize(error);
        return normalized.includes("daily send limit")
            || normalized.includes("mailbox throttle")
            || normalized.includes("rate limit")
            || normalized.includes("temporar")
            || normalized.includes("try again");
    }

    private static async failRun(runId: string, errorCode: string, errorMessage: string, retryable: boolean, now: Date) {
        const retryAt = retryable ? new Date(now.getTime() + 60 * 60 * 1000) : null;
        await db().sequenceStepRun.update({
            where: { id: runId },
            data: {
                status: retryable ? "RETRY_SCHEDULED" : "FAILED",
                scheduledAt: retryAt ?? undefined,
                failedAt: retryable ? undefined : now,
                errorCode,
                errorMessage,
            },
        });
    }

    private static async exitEnrollment(run: any, errorCode: string, now: Date) {
        const client = db();
        await client.sequenceStepRun.update({
            where: { id: run.id },
            data: { status: "SKIPPED_EXITED", completedAt: now, errorCode },
        });
        await client.sequenceEnrollment.update({
            where: { id: run.enrollmentId },
            data: { status: "EXITED", completedAt: now, cancelledAt: now, nextRunAt: null },
        });
    }

    private static async scheduleNextStep(run: any, now: Date) {
        const client = db();
        const enrollment = run.enrollment || await client.sequenceEnrollment.findUnique({ where: { id: run.enrollmentId } });
        const currentStep = run.step || await client.sequenceStep.findUnique({ where: { id: run.sequenceStepId } });
        const nextStep = await client.sequenceStep.findFirst({
            where: {
                sequenceId: enrollment.sequenceId,
                status: "ACTIVE",
                stepOrder: { gt: currentStep.stepOrder },
            },
            orderBy: { stepOrder: "asc" },
        });

        if (!nextStep) {
            await client.sequenceEnrollment.update({
                where: { id: enrollment.id },
                data: {
                    status: "COMPLETED",
                    currentStepOrder: currentStep.stepOrder,
                    lastRunAt: now,
                    nextRunAt: null,
                    completedAt: now,
                },
            });
            return;
        }

        const scheduledAt = new Date(now.getTime() + delayMs(nextStep));
        const existing = await client.sequenceStepRun.findFirst({
            where: {
                enrollmentId: enrollment.id,
                sequenceStepId: nextStep.id,
                status: { in: [...RUN_DUE_STATUSES, "RUNNING", ...RUN_SUCCESS_STATUSES] },
            },
        });

        if (!existing) {
            await client.sequenceStepRun.create({
                data: {
                    teamId: enrollment.teamId,
                    enrollmentId: enrollment.id,
                    sequenceStepId: nextStep.id,
                    mailboxId: enrollment.mailboxId,
                    leadId: enrollment.leadId,
                    campaignId: enrollment.campaignId,
                    status: "SCHEDULED",
                    scheduledAt,
                },
            });
        }

        await client.sequenceEnrollment.update({
            where: { id: enrollment.id },
            data: {
                status: "ACTIVE",
                currentStepOrder: currentStep.stepOrder,
                lastRunAt: now,
                nextRunAt: scheduledAt,
            },
        });
    }
}
