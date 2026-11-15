import { prisma } from "@/lib/db";
import { logger } from "@/lib/logger";
import { aiService, extractJsonBlock } from "@/lib/aiService";
import { CrystalService } from "@/modules/crystal-knows/service/crystalService";
import { buildLegacyBatchPrompt } from "@/lib/ai/legacyDraftPrompt";
import { clampGeneratedText, enforceAIPromptPolicy } from "@/lib/aiInputGuardrails";

const GUIDANCE_CONCURRENCY = 10;
const BATCH_TASK_TYPE = "EMAIL_DRAFT_BATCH";

function buildDraftPrompt(lead: unknown, icp: unknown, personalityGuidance: string): string {
    // Close to aiService.generateEmailDraft's prompt, so a BATCH-mode campaign produces the same style
    // of draft a REALTIME campaign would - this is a cheaper delivery path, not a different prompt.
    return enforceAIPromptPolicy(buildLegacyBatchPrompt({ lead, icp, personalityGuidance }), { surface: "EMAIL", label: "Email generation prompt" });
}

export async function submitBatch(campaignId: string, teamId: string): Promise<{ batchId: string; itemCount: number }> {
    const [leads, campaign] = await Promise.all([
        prisma.lead.findMany({
            where: { campaignId, teamId, isEnriched: true, email: { not: null } },
        }),
        prisma.campaign.findUnique({ where: { id: campaignId }, include: { icp: true } }),
    ]);

    if (leads.length === 0) {
        throw new Error(`No enriched leads with an email found for campaign ${campaignId}`);
    }

    const icp = campaign?.icp?.criteria ?? null;

    // Stored guidance is read straight off the lead; only legacy leads hit Crystal (free). Chunked so a big
    // campaign of legacy leads doesn't fire hundreds of simultaneous requests and trip Crystal's rate limit.
    const guidance: string[] = [];
    for (let i = 0; i < leads.length; i += GUIDANCE_CONCURRENCY) {
        const chunk = leads.slice(i, i + GUIDANCE_CONCURRENCY);
        guidance.push(
            ...(await Promise.all(
                chunk.map((lead) => CrystalService.getGuidanceForLead(teamId, lead, "write a cold outreach email").catch(() => ""))
            ))
        );
    }

    // aiService owns the provider call: the input policy, credit reservation and usage logging.
    const messageBatch = await aiService.submitMessageBatch(
        leads.map((lead, i) => ({ customId: lead.id, prompt: buildDraftPrompt(lead, icp, guidance[i]) })),
        teamId,
        { taskType: BATCH_TASK_TYPE, surface: "EMAIL" }
    );

    const batch = await prisma.aiDraftBatch.create({
        data: {
            campaignId,
            teamId,
            provider: "anthropic",
            providerBatchId: messageBatch.providerBatchId,
            status: "submitted",
            itemCount: leads.length,
        },
    });

    await prisma.aiDraftBatchItem.createMany({
        data: leads.map((lead) => ({
            batchId: batch.id,
            leadId: lead.id,
            customId: lead.id,
            status: "pending",
        })),
    });

    logger.info(`[BatchDraft] Submitted batch ${messageBatch.providerBatchId} for campaign ${campaignId} (${leads.length} leads)`);

    return { batchId: batch.id, itemCount: leads.length };
}

export async function pollBatch(batchId: string): Promise<{ ready: boolean }> {
    const batch = await prisma.aiDraftBatch.findUnique({ where: { id: batchId } });
    if (!batch) throw new Error(`AiDraftBatch ${batchId} not found`);

    if (!(await aiService.isMessageBatchDone(batch.providerBatchId, batch.teamId))) {
        await prisma.aiDraftBatch.update({
            where: { id: batchId },
            data: { status: "polling", pollAttempts: { increment: 1 } },
        });
        return { ready: false };
    }

    const results = await aiService.readMessageBatchResults(batch.providerBatchId, batch.teamId, { taskType: BATCH_TASK_TYPE });
    for (const line of results) {
        if (line.text !== null) {
            const text = line.text;
            try {
                const json = JSON.parse(extractJsonBlock(text));
                await prisma.aiDraftBatchItem.update({
                    where: { customId: line.customId },
                    data: {
                        status: "succeeded",
                        subject: clampGeneratedText(String(json.subject || ""), 160),
                        body: clampGeneratedText(String(json.body || ""), 2200),
                    },
                });
            } catch (parseErr: any) {
                await prisma.aiDraftBatchItem.update({
                    where: { customId: line.customId },
                    data: { status: "failed", error: `Failed to parse draft: ${parseErr?.message ?? "unknown error"}` },
                });
            }
        } else {
            await prisma.aiDraftBatchItem.update({
                where: { customId: line.customId },
                data: { status: "failed", error: line.resultType },
            });
        }
    }

    await prisma.aiDraftBatch.update({
        where: { id: batchId },
        data: { status: "completed", completedAt: new Date() },
    });

    return { ready: true };
}
