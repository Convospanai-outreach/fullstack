import { execSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { allPromptRefs } from "../lib/promptRegistry";
import { loadEvalData, type EvalCase } from "../evals/copy/evalData";
import { buildJudgePrompt, parseJudgeReply, runCopyEval, type DraftCopy } from "../evals/copy/runCopyEval";

// npm run eval:copy -- [--yes] [--max-cases N] [--split dev|heldout]
//
// Scores the current email prompts (Node A, B, C) against the private eval set and rubric in
// EVAL_DATA_DIR, using EVAL_TEAM_ID's provider keys. Every case is a generate call plus a judge
// call, so it spends credits: without --yes this only prints what it would run.

function flag(name: string) {
    const i = process.argv.indexOf(`--${name}`);
    return i === -1 ? undefined : process.argv[i + 1] ?? "";
}

async function main() {
    const data = loadEvalData(process.env["EVAL_DATA_DIR"]);
    const split = flag("split");
    if (split !== undefined && split !== "dev" && split !== "heldout") throw new Error("--split must be dev or heldout.");
    const max = flag("max-cases") !== undefined ? Number(flag("max-cases")) : undefined;
    if (max !== undefined && !(max > 0)) throw new Error("--max-cases must be a positive number.");

    let cases = data.cases.filter((c) => !split || c.split === split);
    if (max) cases = cases.slice(0, max);

    const counts = (s: string) => cases.filter((c) => c.split === s).length;
    console.log(`Eval plan: ${cases.length} cases (dev ${counts("dev")}, heldout ${counts("heldout")}), ${cases.length * 2} model calls.`);
    if (process.argv.includes("--dry-run") || !process.argv.includes("--yes")) {
        console.log("Not run. Add --yes to spend credits and score.");
        return;
    }

    const teamId = process.env["EVAL_TEAM_ID"];
    if (!teamId) throw new Error("Set EVAL_TEAM_ID to the team whose provider keys the eval should use.");

    // Loaded here so a dry run needs no database or provider keys.
    const { aiService, extractJsonBlock } = await import("../lib/aiService");
    const { composeNodeA, composeNodeB, composeNodeC } = await import("../modules/email-campaigner/service/emailComposer");

    const generate = async (c: EvalCase): Promise<DraftCopy> => {
        // Copy the input: the composers add team memories to it.
        const input = structuredClone(c.input) as any;
        const out = c.node === "A" ? await composeNodeA(input, teamId) : c.node === "B" ? await composeNodeB(input, teamId) : await composeNodeC(input, teamId);
        return { subject: out.subject, body: out.body };
    };
    const judge = async (c: EvalCase, draft: DraftCopy, rubric: Parameters<typeof buildJudgePrompt>[2]) => {
        const raw = await aiService.askAI(buildJudgePrompt(c, draft, rubric), teamId, {
            taskType: "CRITIQUE",
            surface: "EMAIL",
            expectsJson: true,
            disableGuardrails: true,
        });
        return parseJudgeReply(JSON.parse(extractJsonBlock(raw)), rubric);
    };

    const report = await runCopyEval(cases, data.rubric, { generate, judge });

    let gitSha = "unknown";
    try {
        gitSha = execSync("git rev-parse --short HEAD", { encoding: "utf8" }).trim();
    } catch { /* not a checkout */ }
    const runsDir = path.join(process.env["EVAL_DATA_DIR"]!, "runs");
    fs.mkdirSync(runsDir, { recursive: true });
    const file = path.join(runsDir, `copy-${new Date().toISOString().replace(/[:.]/g, "-")}.json`);
    fs.writeFileSync(file, JSON.stringify({ gitSha, ranAt: new Date().toISOString(), prompts: allPromptRefs(), ...report }, null, 2));

    console.log(JSON.stringify(report.summary, null, 2));
    console.log(`Full report: ${file}`);
}

main().catch((error) => {
    console.error(error?.message || error);
    process.exit(1);
});
