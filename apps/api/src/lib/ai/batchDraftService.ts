import Anthropic from "@anthropic-ai/sdk";
import { prisma } from "@/lib/db";
import { logger } from "@/lib/logger";
import { loadTeamProviders, extractJsonBlock } from "@/lib/aiService";
import { clampGeneratedText, enforceAIPromptPolicy } from "@/lib/aiInputGuardrails";

const BATCH_MODEL = "claude-3-5-sonnet";

function buildDraftPrompt(lead: unknown): string {
    // Mirrors aiService.generateEmailDraft's prompt shape exactly, so a
    // BATCH-mode campaign produces the same style of draft a REALTIME
    // campaign would - this is a cheaper delivery path, not a different
    // prompt.
    const prompt = `
You are a B2B outreach expert. Draft a cold email.

Lead:
${JSON.stringify(lead)}

ICP:
null

Return JSON with keys: subject, body.
        `.trim();
    return enforceAIPromptPolicy(prompt, { surface: "EMAIL", label: "Email generation prompt" });
}

export async function submitBatch(campaignId: string, teamId: string): Promise<{ batchId: string; itemCount: number }> {
    const leads = await prisma.lead.findMany({
        where: { campaignId, teamId, isEnriched: true, email: { not: null } },
    });

    if (leads.length === 0) {
        throw new Error(`No enriched leads with an email found for campaign ${campaignId}`);
    }

    const providers = await loadTeamProviders(teamId);
    if (!providers.anthropic?.apiKey) {
        throw new Error("BATCH draft generation requires a configured Anthropic API key for this team.");
    }

    const client = new Anthropic({ apiKey: providers.anthropic.apiKey });
    const model = providers.anthropic.model || BATCH_MODEL;

    const messageBatch = await client.messages.batches.create({
        requests: leads.map((lead) => ({
            custom_id: lead.id,
            params: {
                model,
                max_tokens: 800,
                messages: [{ role: "user" as const, content: buildDraftPrompt(lead) }],
            },
        })),
    });

    const batch = await prisma.aiDraftBatch.create({
        data: {
            campaignId,
            teamId,
            provider: "anthropic",
            providerBatchId: messageBatch.id,
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

    logger.info(`[BatchDraft] Submitted batch ${messageBatch.id} for campaign ${campaignId} (${leads.length} leads)`);

    return { batchId: batch.id, itemCount: leads.length };
}

export async function pollBatch(batchId: string): Promise<{ ready: boolean }> {
    const batch = await prisma.aiDraftBatch.findUnique({ where: { id: batchId } });
    if (!batch) throw new Error(`AiDraftBatch ${batchId} not found`);

    const providers = await loadTeamProviders(batch.teamId);
    if (!providers.anthropic?.apiKey) {
        throw new Error(`BATCH draft polling requires a configured Anthropic API key for team ${batch.teamId}.`);
    }

    const client = new Anthropic({ apiKey: providers.anthropic.apiKey });
    const remote = await client.messages.batches.retrieve(batch.providerBatchId);

    if (remote.processing_status !== "ended") {
        await prisma.aiDraftBatch.update({
            where: { id: batchId },
            data: { status: "polling", pollAttempts: { increment: 1 } },
        });
        return { ready: false };
    }

    const results = await client.messages.batches.results(batch.providerBatchId);
    for await (const line of results) {
        if (line.result.type === "succeeded") {
            const text = line.result.message.content?.[0]?.type === "text" ? line.result.message.content[0].text : "";
            try {
                const json = JSON.parse(extractJsonBlock(text));
                await prisma.aiDraftBatchItem.update({
                    where: { customId: line.custom_id },
                    data: {
                        status: "succeeded",
                        subject: clampGeneratedText(String(json.subject || ""), 160),
                        body: clampGeneratedText(String(json.body || ""), 2200),
                    },
                });
            } catch (parseErr: any) {
                await prisma.aiDraftBatchItem.update({
                    where: { customId: line.custom_id },
                    data: { status: "failed", error: `Failed to parse draft: ${parseErr?.message ?? "unknown error"}` },
                });
            }
        } else {
            await prisma.aiDraftBatchItem.update({
                where: { customId: line.custom_id },
                data: { status: "failed", error: line.result.type },
            });
        }
    }

    await prisma.aiDraftBatch.update({
        where: { id: batchId },
        data: { status: "completed", completedAt: new Date() },
    });

    return { ready: true };
}
