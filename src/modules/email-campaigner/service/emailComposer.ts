/**
 * emailComposer.ts
 * AI-powered email composition for the three-node outreach sequence.
 *
 * Node A → Cold email (signal-driven, 90-120 words)
 * Node B → 3-day follow-up for opens with no reply (cost/consequence angle, 60-80 words)
 * Node C → 5-day follow-up for no opens (pattern-interrupt, ultra-short, 2 sentences max)
 *
 * Uses Claude Sonnet 4 via the /api/ai/proxy or falls back to Gemini via aiStatsService.
 */
import { aiService } from "@/lib/aiService";
import { LearningService } from "@/modules/learning/learningService";
import { KnowledgeOrchestrator } from "@/modules/knowledge/services/knowledgeOrchestrator";

const knowledgeOrchestrator = new KnowledgeOrchestrator();

// ─── Node A Types ─────────────────────────────────────────────────────────────
export interface NodeAInput {
    prospect_name: string;
    prospect_title: string;
    prospect_company: string;
    pain_context: string;
    outreach_timing: string;
    avoid_topics: string[];
    hypothesis: string;
    signal_type: string;
    extracted_signal: string;
    sender_name: string;
    sender_email: string;
    knowledge_context?: string;
    memories?: string[];
}

export interface NodeAOutput {
    subject: string;
    body: string;
    internal_notes: string;
}

// ─── Node B Types ─────────────────────────────────────────────────────────────
export interface NodeBInput {
    prospect_name: string;
    prospect_title: string;
    prospect_company: string;
    original_subject: string;
    original_body: string;
    hypothesis: string;
    pain_context: string;
    days_since_send: number; // always 3
    memories?: string[];
}

export interface NodeBOutput {
    subject: string;
    body: string;
    reasoning: string;
}

// ─── Node C Types ─────────────────────────────────────────────────────────────
export interface NodeCInput {
    prospect_name: string;
    prospect_title: string;
    prospect_company: string;
    original_subject: string;
    original_body: string;
    hypothesis: string;
    signal_type: string;
    memories?: string[];
}

export interface NodeCOutput {
    subject: string;
    body: string;
    reasoning: string;
}

// ─── Prompt builders ──────────────────────────────────────────────────────────

function buildNodeAPrompt(input: NodeAInput): string {
    return `You write B2B cold emails that feel like they came from a brilliant peer, not a vendor.

## THE ONE RULE THAT OVERRIDES EVERYTHING
The prospect must feel, within the first sentence, that you read something *specific* they did or said — not that you scraped their job title. If you cannot be specific, do not send the email.

## SUBJECT LINE
- 5–7 words maximum
- Must reference the specific signal, not the prospect's role or company name
- No questions. No "quick question". No emojis.
- Should create mild curiosity — not clickbait, not a claim
- Test: would this subject line work for anyone else? If yes, rewrite it.

## BODY STRUCTURE — 4 PARTS, 90–120 WORDS TOTAL
**Part 1 — The Mirror (1 sentence):** Name the exact signal. Not a paraphrase. Make them think "how did they see that?"
**Part 2 — The Hypothesis (1–2 sentences):** Your specific diagnosis of WHY they have this problem. Not what your product does — what their situation looks like from outside.
**Part 3 — The Proof Spike (1 sentence):** One single credible data point or customer result. Specific enough to be believable.
**Part 4 — The CTA (1 sentence):** Lowest possible friction. A yes/no question they can answer in 10 seconds.

## TONE
Peer-to-peer. No: "I hope this finds you well", "I came across your profile", "I'd love to", "just wanted to". No feature lists. Plain language.

## AVOID TOPICS
Do not reference or imply: ${input.avoid_topics.join(", ") || "none specified"}

## INPUT
Prospect: ${input.prospect_name}, ${input.prospect_title} at ${input.prospect_company}
Signal: ${input.extracted_signal}
Pain context: ${input.pain_context}
Timing: ${input.outreach_timing}
Hypothesis: ${input.hypothesis}
Sender: ${input.sender_name} <${input.sender_email}>

## KNOWLEDGE_CONTEXT (TOON FORMAT)
${input.knowledge_context || "None available."}

## OUTPUT FORMAT
Respond ONLY with valid JSON in this exact structure:
{
  "subject": "...",
  "body": "...",
  "internal_notes": "..."
}

## LESSONS LEARNED (FEEDBACK LOOP)
${input.memories?.join("\n") || "No specific team patterns recorded yet."}`;
}

function buildCritiquePrompt(input: any, draft: any): string {
    return `You are a Senior Copy Editor reviewing a cold email.
    
    ## DRAFT
    Subject: ${draft.subject}
    Body: ${draft.body}
    
    ## CRITIQUE CRITERIA
    1. Generic Vendor Tone: Does it sound like "I want to sell you X"? (Must be peer-to-peer)
    2. Specificity: Is the first sentence truly specific to their signal?
    3. Length: Is it bloated? (Target < 100 words)
    4. Friction: Is the CTA too aggressive? (Must be low-friction)
    5. Hallucination: Does it mention things NOT in the provided signal/context?
    6. Masking Violation: Does it contain raw emails/phones? (Tokens like [EMAIL_HASH] are OK).
    
    ## TASK
    If the email is perfect, respond ONLY with "PASS".
    If it needs improvement, explain EXACTLY why and provide a corrected version.
    
    Respond in JSON:
    {
      "status": "PASS" | "FAIL",
      "critique": "...",
      "correction": { "subject": "...", "body": "..." }
    }`;
}

function buildNodeBPrompt(input: NodeBInput): string {
    return `You write Node B follow-ups — sent when a prospect opened the initial email but didn't reply after 3 days.

## RULES
- New subject line. Do NOT use "Re:" — this is a fresh angle.
- Never say "just following up", "circling back", "bumping this", "wanted to check in"
- Never repeat content from the original email
- New angle: address the business cost of their pain — what happens if they don't solve it in Q2/Q3
- Length: 60–80 words maximum
- End with a softer CTA — a reaction, not a commitment

## SUBJECT LINE
Different from original. Same specificity rule. Try: consequence angle or reframe.

## BODY STRUCTURE
Sentence 1: Acknowledge you reached out — briefly, without apologising
Sentences 2–3: Cost/consequence angle. What does another 90 days of this problem look like?
Sentence 4: Softer CTA — "Relevant or not?" / "Still on your radar?" / "Worth 5 minutes?"

## INPUT
Prospect: ${input.prospect_name}, ${input.prospect_title} at ${input.prospect_company}
Original subject: ${input.original_subject}
Original email:
"""
${input.original_body}
"""
Hypothesis: ${input.hypothesis}
Pain context: ${input.pain_context}

## OUTPUT FORMAT
Respond ONLY with valid JSON:
{
  "subject": "...",
  "body": "...",
  "reasoning": "..."
}

## LESSONS LEARNED (FEEDBACK LOOP)
${input.memories?.join("\n") || "No specific team patterns recorded yet."}`;
}

function buildNodeCPrompt(input: NodeCInput): string {
    return `You write Node C follow-ups — sent when a prospect never opened the initial email after 5 days. This is the last touchpoint. After this, silence.

## STRATEGY
Ultra-short. Pattern-interrupt subject line. One sentence body. One question.

## SUBJECT LINE OPTIONS
- A direct question: "still relevant?"
- Something disarmingly short: "wrong timing?"
- First name only: "${input.prospect_name}"
NEVER: "Following up on my previous email" — they didn't see it.

## BODY — MAX 3 SENTENCES (ideally 2)
Do NOT: reference previous emails, repeat hypothesis, explain your product, apologise for reaching out.
DO: ask one direct question about their current state; make it easy to say no.

Line 1: One sentence restating the core problem as a question about their current state.
Line 2: Permission to ignore. "If it's not relevant, no need to reply — but if it is, I'm here."

## INPUT
Prospect: ${input.prospect_name}, ${input.prospect_title} at ${input.prospect_company}
Original subject: ${input.original_subject}
Hypothesis: ${input.hypothesis}
Signal type: ${input.signal_type}

## OUTPUT FORMAT
Respond ONLY with valid JSON:
{
  "subject": "...",
  "body": "...",
  "reasoning": "..."
}

## LESSONS LEARNED (FEEDBACK LOOP)
${input.memories?.join("\n") || "No specific team patterns recorded yet."}`;
}

// ─── Parser ───────────────────────────────────────────────────────────────────

function parseJsonResponse<T>(raw: string): T {
    // Strip markdown code fences if present
    const cleaned = raw.replace(/^```(?:json)?\s*/i, "").replace(/\s*```\s*$/, "").trim();
    return JSON.parse(cleaned) as T;
}

// ─── Public compose functions ─────────────────────────────────────────────────

export async function composeNodeA(
    input: NodeAInput,
    teamId: string,
    campaignId?: string,
    leadId?: string
): Promise<NodeAOutput> {
    // 1. SELF-LEARNING: Fetch past team successes/lessons
    input.memories = await LearningService.getMemories(teamId);

    if (campaignId && leadId) {
        input.knowledge_context = await knowledgeOrchestrator.getCampaignContext(campaignId, leadId);
    }

    // 2. INITIAL GENERATION
    const prompt = buildNodeAPrompt(input);
    const raw = await aiService.askAI(prompt, teamId, { taskType: "EMAIL_DRAFT" });
    const draft = parseJsonResponse<NodeAOutput>(raw);

    // 3. SELF-CHECKING & SELF-CORRECTING LOOP
    const critiquePrompt = buildCritiquePrompt(input, draft);
    const critiqueRaw = await aiService.askAI(critiquePrompt, teamId, { taskType: "CRITIQUE" });
    
    try {
        const critiqueResult = parseJsonResponse<any>(critiqueRaw);
        if (critiqueResult.status === "FAIL" && critiqueResult.correction) {
            console.log(`[Self-Correction] Pivot applied: ${critiqueResult.critique}`);
            return {
                ...draft,
                subject: critiqueResult.correction.subject,
                body: critiqueResult.correction.body,
                internal_notes: `${draft.internal_notes}\n\n[SELF-CORRECTION]: ${critiqueResult.critique}`
            };
        }
    } catch (e) {
        // Fallback to original if critique parsing fails
    }

    return draft;
}

export async function composeNodeB(
    input: NodeBInput,
    teamId: string
): Promise<NodeBOutput> {
    // 1. SELF-LEARNING
    input.memories = await LearningService.getMemories(teamId);

    // 2. INITIAL GENERATION
    const prompt = buildNodeBPrompt(input);
    const raw = await aiService.askAI(prompt, teamId, { taskType: "EMAIL_DRAFT" });
    const draft = parseJsonResponse<NodeBOutput>(raw);

    // 3. SELF-CHECKING & SELF-CORRECTING LOOP
    const critiquePrompt = buildCritiquePrompt(input, draft);
    const critiqueRaw = await aiService.askAI(critiquePrompt, teamId, { taskType: "CRITIQUE" });

    try {
        const critiqueResult = parseJsonResponse<any>(critiqueRaw);
        if (critiqueResult.status === "FAIL" && critiqueResult.correction) {
            console.log(`[Self-Correction: Node B] Resulted in pivot: ${critiqueResult.critique}`);
            return {
                ...draft,
                subject: critiqueResult.correction.subject,
                body: critiqueResult.correction.body,
                reasoning: `${draft.reasoning}\n\n[SELF-CORRECTION]: ${critiqueResult.critique}`
            };
        }
    } catch (e) {}

    return draft;
}

export async function composeNodeC(
    input: NodeCInput,
    teamId: string
): Promise<NodeCOutput> {
    // 1. SELF-LEARNING
    input.memories = await LearningService.getMemories(teamId);

    // 2. INITIAL GENERATION
    const prompt = buildNodeCPrompt(input);
    const raw = await aiService.askAI(prompt, teamId, { taskType: "EMAIL_DRAFT" });
    const draft = parseJsonResponse<NodeCOutput>(raw);

    // 3. SELF-CHECKING & SELF-CORRECTING LOOP
    const critiquePrompt = buildCritiquePrompt(input, draft);
    const critiqueRaw = await aiService.askAI(critiquePrompt, teamId, { taskType: "CRITIQUE" });

    try {
        const critiqueResult = parseJsonResponse<any>(critiqueRaw);
        if (critiqueResult.status === "FAIL" && critiqueResult.correction) {
            console.log(`[Self-Correction: Node C] Resulted in pivot: ${critiqueResult.critique}`);
            return {
                ...draft,
                subject: critiqueResult.correction.subject,
                body: critiqueResult.correction.body,
                reasoning: `${draft.reasoning}\n\n[SELF-CORRECTION]: ${critiqueResult.critique}`
            };
        }
    } catch (e) {}

    return draft;
}
