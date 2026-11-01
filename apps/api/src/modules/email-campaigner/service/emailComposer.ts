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
import { clampGeneratedText, enforceAIPromptPolicy } from "@/lib/aiInputGuardrails";
import { enforceMultilineGuardrails } from "@/lib/ai/agentOutputGuardrails";
import type { Rubric } from "@/evals/copy/evalData";
import { loadCopyContext, renderCopyContext, type CopyContext } from "./copyContext";
import { buildRubricCritiquePrompt, loadCriticRubric, readRubricVerdict } from "./rubricCritic";

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
    tone?: string;
    voice?: string;
    formulation?: string;
    greeting_style?: string;
    sign_off?: string;
    cta_style?: string;
    constraints?: string;
    knowledge_context?: string;
    memories?: string[];
}

export interface NodeAOutput {
    subject: string;
    body: string;
    internal_notes: string;
    // True when the critic's verdict could not be used, so nothing checked this draft.
    unreviewed?: boolean;
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
    tone?: string;
    voice?: string;
    formulation?: string;
    greeting_style?: string;
    sign_off?: string;
    cta_style?: string;
    constraints?: string;
    memories?: string[];
}

export interface NodeBOutput {
    subject: string;
    body: string;
    reasoning: string;
    // True when the critic's verdict could not be used, so nothing checked this draft.
    unreviewed?: boolean;
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
    tone?: string;
    voice?: string;
    formulation?: string;
    greeting_style?: string;
    sign_off?: string;
    cta_style?: string;
    constraints?: string;
    memories?: string[];
}

export interface NodeCOutput {
    subject: string;
    body: string;
    reasoning: string;
    // True when the critic's verdict could not be used, so nothing checked this draft.
    unreviewed?: boolean;
}

// ─── Prompt builders ──────────────────────────────────────────────────────────

function buildStyleGuidance(input: {
    tone?: string;
    voice?: string;
    formulation?: string;
    greeting_style?: string;
    sign_off?: string;
    cta_style?: string;
    constraints?: string;
}) {
    const guidance = [
        input.tone ? `Tone: ${input.tone}` : null,
        input.voice ? `Voice: ${input.voice}` : null,
        input.formulation ? `Formulation: ${input.formulation}` : null,
        input.greeting_style ? `Greeting: ${input.greeting_style}` : null,
        input.sign_off ? `Sign-off: ${input.sign_off}` : null,
        input.cta_style ? `CTA style: ${input.cta_style}` : null,
        input.constraints ? `Constraints: ${input.constraints}` : null,
    ].filter(Boolean);

    if (guidance.length === 0) {
        return "Use the default CraftMyFunnel voice: concise, respectful, and buyer-first.";
    }

    return guidance.join("\n");
}

// Static instructions + this team's style settings - identical across every
// lead in a campaign (style only changes when the team edits it), so this is
// sent as a cacheable system prompt rather than baked into the per-lead
// prompt: Anthropic serves repeat calls from its ephemeral prompt cache
// instead of rebilling these ~20 lines as fresh input tokens every time.
export function buildNodeASystemPrompt(input: NodeAInput): string {
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

## STYLE SETTINGS
${buildStyleGuidance(input)}`;
}

export function buildNodeAPrompt(input: NodeAInput, context?: CopyContext | null): string {
    return `## AVOID TOPICS
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

## OUTPUT REQUIREMENTS
- Include the greeting style and sign-off if provided in STYLE SETTINGS.
- Honor the CTA style guidance (direct vs soft, link-first vs question-first).

## OUTPUT FORMAT
Respond ONLY with valid JSON in this exact structure:
{
  "subject": "...",
  "body": "...",
  "internal_notes": "..."
}

## LESSONS LEARNED (FEEDBACK LOOP)
${input.memories?.join("\n") || "No specific team patterns recorded yet."}${renderCopyContext(context)}`;
}

export function buildCritiquePrompt(input: any, draft: any): string {
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

    ## STYLE REQUIREMENTS
    ${buildStyleGuidance(input)}
    
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

export function buildNodeBPrompt(input: NodeBInput, context?: CopyContext | null): string {
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

## STYLE SETTINGS
${buildStyleGuidance(input)}

## OUTPUT FORMAT
Respond ONLY with valid JSON:
{
  "subject": "...",
  "body": "...",
  "reasoning": "..."
}

## LESSONS LEARNED (FEEDBACK LOOP)
${input.memories?.join("\n") || "No specific team patterns recorded yet."}${renderCopyContext(context)}`;
}

export function buildNodeCPrompt(input: NodeCInput, context?: CopyContext | null): string {
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

## STYLE SETTINGS
${buildStyleGuidance(input)}

## OUTPUT FORMAT
Respond ONLY with valid JSON:
{
  "subject": "...",
  "body": "...",
  "reasoning": "..."
}

## LESSONS LEARNED (FEEDBACK LOOP)
${input.memories?.join("\n") || "No specific team patterns recorded yet."}${renderCopyContext(context)}`;
}

// ─── Parser ───────────────────────────────────────────────────────────────────

function parseJsonResponse<T>(raw: string): T {
    // Strip markdown code fences if present
    const cleaned = raw.replace(/^```(?:json)?\s*/i, "").replace(/\s*```\s*$/, "").trim();
    return JSON.parse(cleaned) as T;
}

type CritiqueVerdict = { status?: string; critique?: string; correction?: { subject?: string; body?: string } };

const UNREVIEWED_NOTE = "[UNREVIEWED]: the critic's answer could not be used, so this draft was not checked.";

// The critic's verdict, or null when its answer is not valid JSON. A null is logged (with the
// parse error, never the draft) so a broken critic shows up instead of passing drafts silently.
function readCritique(raw: string, label: string): CritiqueVerdict | null {
    try {
        return parseJsonResponse<CritiqueVerdict>(raw);
    } catch (error) {
        console.warn(`[Critique] ${label}: the critic's answer could not be read; the draft is marked unreviewed`, {
            error: error instanceof Error ? error.message : String(error),
        });
        return null;
    }
}

// Same contract as readCritique, for the rubric critic's reply.
function readRubricCritique(raw: string, label: string, rubric: Rubric): CritiqueVerdict | null {
    try {
        return readRubricVerdict(parseJsonResponse<unknown>(raw), rubric);
    } catch (error) {
        console.warn(`[Critique] ${label}: the rubric critic's answer could not be used; the draft is marked unreviewed`, {
            error: error instanceof Error ? error.message : String(error),
        });
        return null;
    }
}

// One critique call per draft: scored against the private rubric when COPY_RUBRIC_DIR is set,
// the standard critique otherwise.
async function critiqueDraft(input: any, draft: { subject: string; body: string }, teamId: string, label: string): Promise<CritiqueVerdict | null> {
    const rubric = loadCriticRubric();
    const prompt = rubric ? buildRubricCritiquePrompt(input, draft, rubric, buildStyleGuidance(input)) : buildCritiquePrompt(input, draft);
    const raw = await aiService.askAI(prompt, teamId, { taskType: "CRITIQUE", surface: "EMAIL", expectsJson: true, disableGuardrails: true });
    return rubric ? readRubricCritique(raw, label, rubric) : readCritique(raw, label);
}

// A usable correction needs both fields; anything else leaves the original draft unchecked.
function usableCorrection(verdict: CritiqueVerdict | null): { subject: string; body: string } | null {
    const correction = verdict?.status === "FAIL" ? verdict.correction : undefined;
    return correction?.subject && correction?.body ? { subject: correction.subject, body: correction.body } : null;
}

// The critic's rewrite is model output that no guardrail has seen (JSON answers skip them), and
// a rewrite is where an invented statistic or a guarantee can slip in. Numbers must already
// appear in the input or the original draft; certainty words are softened. Null when nothing
// usable is left, so the caller keeps the original draft and marks it unreviewed.
function guardCorrection(
    correction: { subject: string; body: string } | null,
    input: unknown,
    draft: { subject: string; body: string },
    label: string,
): { subject: string; body: string } | null {
    if (!correction) return null;
    const options = { sourceContext: [JSON.stringify(input), draft.subject, draft.body].join("\n"), strictGrounding: true };
    const subject = enforceMultilineGuardrails(correction.subject, options);
    const body = enforceMultilineGuardrails(correction.body, options);
    const codes = [...new Set([...subject.issues, ...body.issues].map((issue) => issue.code))];
    if (codes.length > 0) console.warn(`[Guardrails] ${label}: the critic's rewrite was adjusted`, { issues: codes });
    if (!body.text) return null;
    return { subject: subject.text || draft.subject, body: body.text };
}

function enforceInputBudget(label: string, input: unknown, maxChars: number) {
    const serialized = JSON.stringify(input || {});
    if (serialized.length > maxChars) {
        throw new Error(`${label} input exceeds ${maxChars} characters.`);
    }
    enforceAIPromptPolicy(serialized, {
        surface: "EMAIL",
        maxChars,
        label: `${label} input`
    });
}

function normalizeNodeAOutput(output: NodeAOutput): NodeAOutput {
    return {
        subject: clampGeneratedText(String(output.subject || ""), 160),
        body: clampGeneratedText(String(output.body || ""), 2200),
        internal_notes: clampGeneratedText(String(output.internal_notes || ""), 1200)
    };
}

function normalizeNodeBOutput(output: NodeBOutput): NodeBOutput {
    return {
        subject: clampGeneratedText(String(output.subject || ""), 160),
        body: clampGeneratedText(String(output.body || ""), 1700),
        reasoning: clampGeneratedText(String(output.reasoning || ""), 1000)
    };
}

function normalizeNodeCOutput(output: NodeCOutput): NodeCOutput {
    return {
        subject: clampGeneratedText(String(output.subject || ""), 160),
        body: clampGeneratedText(String(output.body || ""), 1200),
        reasoning: clampGeneratedText(String(output.reasoning || ""), 1000)
    };
}

// ─── Public compose functions ─────────────────────────────────────────────────

export async function composeNodeA(
    input: NodeAInput,
    teamId: string,
    campaignId?: string,
    leadId?: string
): Promise<NodeAOutput> {
    enforceInputBudget("Node A", input, 7000);
    // 1. SELF-LEARNING: Fetch past team successes/lessons relevant to this lead's situation
    input.memories = await LearningService.getMemories(
        teamId,
        `${input.prospect_company} ${input.pain_context} ${input.hypothesis}`
    );

    if (campaignId && leadId) {
        input.knowledge_context = await knowledgeOrchestrator.getCampaignContext(campaignId, leadId);
    }

    // 2. INITIAL GENERATION
    const prompt = buildNodeAPrompt(input, await loadCopyContext("A", input as unknown as Record<string, unknown>));
    const raw = await aiService.askAI(prompt, teamId, { taskType: "EMAIL_DRAFT", surface: "EMAIL", expectsJson: true, disableGuardrails: true, systemPrompt: buildNodeASystemPrompt(input) });
    const draft = parseJsonResponse<NodeAOutput>(raw);

    // 3. SELF-CHECKING & SELF-CORRECTING LOOP
    const verdict = await critiqueDraft(input, draft, teamId, "Node A");
    const correction = guardCorrection(usableCorrection(verdict), input, draft, "Node A");
    if (correction) {
        console.log(`[Self-Correction] Pivot applied: ${verdict?.critique}`);
        return normalizeNodeAOutput({
            ...draft,
            subject: correction.subject,
            body: correction.body,
            internal_notes: `${draft.internal_notes}\n\n[SELF-CORRECTION]: ${verdict?.critique}`
        });
    }

    const normalized = normalizeNodeAOutput(draft);
    if (verdict?.status === "PASS") return normalized;
    if (verdict) console.warn("[Critique] Node A: the critic gave no usable verdict or correction; the draft is marked unreviewed", { status: verdict.status });
    return { ...normalized, internal_notes: `${normalized.internal_notes}\n\n${UNREVIEWED_NOTE}`, unreviewed: true };
}

export async function composeNodeB(
    input: NodeBInput,
    teamId: string
): Promise<NodeBOutput> {
    enforceInputBudget("Node B", input, 6500);
    // 1. SELF-LEARNING: Fetch past team successes/lessons relevant to this lead's situation
    input.memories = await LearningService.getMemories(
        teamId,
        `${input.prospect_company} ${input.pain_context} ${input.hypothesis}`
    );

    // 2. INITIAL GENERATION
    const prompt = buildNodeBPrompt(input, await loadCopyContext("B", input as unknown as Record<string, unknown>));
    const raw = await aiService.askAI(prompt, teamId, { taskType: "EMAIL_DRAFT", surface: "EMAIL", expectsJson: true, disableGuardrails: true });
    const draft = parseJsonResponse<NodeBOutput>(raw);

    // 3. SELF-CHECKING & SELF-CORRECTING LOOP
    const verdict = await critiqueDraft(input, draft, teamId, "Node B");
    const correction = guardCorrection(usableCorrection(verdict), input, draft, "Node B");
    if (correction) {
        console.log(`[Self-Correction: Node B] Resulted in pivot: ${verdict?.critique}`);
        return normalizeNodeBOutput({
            ...draft,
            subject: correction.subject,
            body: correction.body,
            reasoning: `${draft.reasoning}\n\n[SELF-CORRECTION]: ${verdict?.critique}`
        });
    }

    const normalized = normalizeNodeBOutput(draft);
    if (verdict?.status === "PASS") return normalized;
    if (verdict) console.warn("[Critique] Node B: the critic gave no usable verdict or correction; the draft is marked unreviewed", { status: verdict.status });
    return { ...normalized, reasoning: `${normalized.reasoning}\n\n${UNREVIEWED_NOTE}`, unreviewed: true };
}

export async function composeNodeC(
    input: NodeCInput,
    teamId: string
): Promise<NodeCOutput> {
    enforceInputBudget("Node C", input, 6000);
    // 1. SELF-LEARNING: Fetch past team successes/lessons relevant to this lead's situation
    input.memories = await LearningService.getMemories(
        teamId,
        `${input.prospect_company} ${input.signal_type} ${input.hypothesis}`
    );

    // 2. INITIAL GENERATION
    const prompt = buildNodeCPrompt(input, await loadCopyContext("C", input as unknown as Record<string, unknown>));
    const raw = await aiService.askAI(prompt, teamId, { taskType: "EMAIL_DRAFT", surface: "EMAIL", expectsJson: true, disableGuardrails: true });
    const draft = parseJsonResponse<NodeCOutput>(raw);

    // 3. SELF-CHECKING & SELF-CORRECTING LOOP
    const verdict = await critiqueDraft(input, draft, teamId, "Node C");
    const correction = guardCorrection(usableCorrection(verdict), input, draft, "Node C");
    if (correction) {
        console.log(`[Self-Correction: Node C] Resulted in pivot: ${verdict?.critique}`);
        return normalizeNodeCOutput({
            ...draft,
            subject: correction.subject,
            body: correction.body,
            reasoning: `${draft.reasoning}\n\n[SELF-CORRECTION]: ${verdict?.critique}`
        });
    }

    const normalized = normalizeNodeCOutput(draft);
    if (verdict?.status === "PASS") return normalized;
    if (verdict) console.warn("[Critique] Node C: the critic gave no usable verdict or correction; the draft is marked unreviewed", { status: verdict.status });
    return { ...normalized, reasoning: `${normalized.reasoning}\n\n${UNREVIEWED_NOTE}`, unreviewed: true };
}
