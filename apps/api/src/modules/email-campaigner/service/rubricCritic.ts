import fs from "node:fs";
import path from "node:path";
import { assertOutsideRepo, parseRubric, type Rubric } from "@/evals/copy/evalData";
import { parseJudgeReply, weightedScore } from "@/evals/copy/runCopyEval";

// The rubric critic scores a draft against a private, weighted rubric in place of the standard
// critique. The rubric is read from COPY_RUBRIC_DIR/rubric.json, a folder outside the checkout (this
// repo is public). With COPY_RUBRIC_DIR unset, or the rubric unreadable, the composers use the
// standard critique, so nothing changes until the folder is set.
//
// Use a different rubric here than the one the eval judge scores with: if both are the same, the
// eval mostly measures whether the judge agrees with itself.

// Fails a draft whatever its score: a well-written email that invents facts or leaks contact
// details must not pass.
const BLOCKERS = [
    "hallucination: the email mentions things that are not in the situation and context below.",
    "masking: the email contains a raw email address or phone number (tokens like [EMAIL_HASH] are fine).",
];

export interface RubricVerdict {
    status: "PASS" | "FAIL";
    critique: string;
    correction?: { subject?: string; body?: string };
    weighted: number;
    blockers: string[];
}

export function loadCriticRubric(dir: string | undefined = process.env["COPY_RUBRIC_DIR"], repoRoot?: string | null): Rubric | null {
    if (!dir) return null;
    try {
        if (repoRoot === undefined) assertOutsideRepo(dir);
        else assertOutsideRepo(dir, repoRoot);
        return parseRubric(JSON.parse(fs.readFileSync(path.join(dir, "rubric.json"), "utf8")));
    } catch (error) {
        console.warn("[Critique] COPY_RUBRIC_DIR is set but its rubric could not be used; using the standard critique", {
            error: error instanceof Error ? error.message : String(error),
        });
        return null;
    }
}

export function buildRubricCritiquePrompt(
    input: Record<string, unknown>,
    draft: { subject: string; body: string },
    rubric: Rubric,
    styleGuidance: string,
): string {
    const criteria = rubric.criteria.map((c) => `- ${c.id}: ${c.description}`).join("\n");
    return `You are a Senior Copy Editor scoring one cold email against a rubric.

## DRAFT
Subject: ${draft.subject}
Body: ${draft.body}

## RUBRIC
Score each criterion from 1 (poor) to 5 (excellent). Do not reward length.
${criteria}

## BLOCKERS
Separately from the scores, list the ones that apply:
${BLOCKERS.map((b) => `- ${b}`).join("\n")}

## SITUATION AND CONTEXT (JSON)
${JSON.stringify(input)}

## STYLE REQUIREMENTS
${styleGuidance}

## TASK
If any blocker applies, or the weighted average of your scores is below ${rubric.passScore}, also write a corrected version that fixes the weakest points. Otherwise set "correction" to null.

Respond in JSON only:
{
  "scores": { ${rubric.criteria.map((c) => `"${c.id}": <1-5>`).join(", ")} },
  "blockers": ["hallucination" | "masking"],
  "critique": "one or two sentences on the weakest points",
  "correction": { "subject": "...", "body": "..." } | null
}`;
}

// Turns the critic's parsed reply into a pass or fail. Throws on a reply that skips a criterion,
// scores outside 1 to 5, or has no blockers list, so a bad reply is "unreviewed" instead of a pass.
export function readRubricVerdict(reply: unknown, rubric: Rubric): RubricVerdict {
    const parsed = reply as { blockers?: unknown; critique?: unknown; correction?: { subject?: unknown; body?: unknown } | null } | null;
    const { scores } = parseJudgeReply(reply, rubric);
    if (!Array.isArray(parsed?.blockers) || parsed.blockers.some((b) => typeof b !== "string")) {
        throw new Error("Critic reply has no blockers list.");
    }
    const blockers = parsed.blockers as string[];
    const weighted = weightedScore(scores, rubric);
    const correction = parsed.correction;
    return {
        status: blockers.length === 0 && weighted >= rubric.passScore ? "PASS" : "FAIL",
        critique: typeof parsed.critique === "string" ? parsed.critique : "",
        ...(correction && typeof correction.subject === "string" && typeof correction.body === "string"
            ? { correction: { subject: correction.subject, body: correction.body } }
            : {}),
        weighted,
        blockers,
    };
}
