import { TOON } from "@/lib/ai/TOON";

// The prompts behind the older email draft path (email-worker): one for a live draft, one for a batch
// draft. They live here, apart from aiService and batchDraftService, so the prompt registry can render
// and fingerprint them without loading those modules.

export function buildLegacyDraftPrompt(input: { lead: unknown; icp: unknown; knowledgeContext: string; personalityGuidance: string }): string {
    // TOON's compact tabular serialization instead of JSON.stringify -
    // drops repeated-key/quote overhead from a full Prisma lead/ICP row,
    // cutting prompt tokens on every email-draft call.
    return `
You are a B2B outreach expert. Draft a cold email.

Lead:
${TOON.serializeTabular(input.lead)}

ICP:
${TOON.serializeTabular(input.icp)}

Relevant knowledge base context:
${input.knowledgeContext || "None"}

Personality guidance (DISC):
${input.personalityGuidance || "None"}

Return JSON with keys: subject, body.
        `.trim();
}

// Close to the live prompt but without the knowledge context, and with JSON rows.
export function buildLegacyBatchPrompt(input: { lead: unknown; icp: unknown; personalityGuidance: string }): string {
    return `
You are a B2B outreach expert. Draft a cold email.

Lead:
${JSON.stringify(input.lead)}

ICP:
${JSON.stringify(input.icp)}

Personality guidance (DISC):
${input.personalityGuidance || "None"}

Return JSON with keys: subject, body.
        `.trim();
}
