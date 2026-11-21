import { execSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { allPromptRefs } from "../lib/promptRegistry";
import { loadEvalData, type EvalCase } from "../evals/copy/evalData";
import { abPlan, runAb, type Variant } from "../evals/copy/abRunner";
import { buildJudgePrompt, parseJudgeReply, type DraftCopy } from "../evals/copy/runCopyEval";
import { parseExtraPhrases } from "../evals/copy/slopScore";
import { parseVariantSpec } from "../evals/copy/variantSpec";
import { rewriteDraft } from "../evals/copy/slopRewrite";

// npm run eval:ab -- [--variants current,current@openai:gpt-4o] [--split dev|heldout] [--max-cases N] [--yes]
//
// Runs the same private eval cases through each variant and compares them with the first one, on the
// rubric judge and the rule-based slop score. Every case is a generate call plus a judge call per
// variant, so it spends credits: without --yes this only prints the plan. The default split is dev;
// heldout is for a final check and must be asked for by name. Do not tune against it.
//
// Variants are listed in VARIANTS below. Later steps add prompt variants, a rewrite pass and
// provider/model overrides here.

function flag(name: string) {
    const i = process.argv.indexOf(`--${name}`);
    return i === -1 ? undefined : process.argv[i + 1] ?? "";
}

type VariantFactory = (teamId: string) => Promise<Variant>;

// A variant is the composers as they are, plus optionally extra style rules appended to the draft
// prompt and/or a rewrite pass over the finished draft. Your own wording goes in the private
// variants.json ({"name": {"addendum": "...", "rewrite": true}}), which overrides these by name.
interface VariantDef {
    addendum?: string;
    rewrite?: boolean;
}

const BUILT_IN: Record<string, VariantDef> = {
    current: {},
    plain: { addendum: "Write like one person messaging another. Short sentences, concrete words, one idea per sentence. No greetings about their wellbeing, no praise, no buzzwords, no exclamation marks, no em dashes." },
    rewrite: { rewrite: true },
    "plain-rewrite": {
        addendum: "Write like one person messaging another. Short sentences, concrete words, one idea per sentence. No greetings about their wellbeing, no praise, no buzzwords, no exclamation marks, no em dashes.",
        rewrite: true,
    },
};

function parseVariantDefs(raw: unknown): Record<string, VariantDef> {
    if (typeof raw !== "object" || raw === null || Array.isArray(raw)) throw new Error("variants.json must be an object of named variants.");
    return Object.fromEntries(
        Object.entries(raw).map(([name, d]) => {
            const def = d as VariantDef;
            if (def.addendum !== undefined && (typeof def.addendum !== "string" || !def.addendum.trim())) throw new Error(`variants.json ${name}: addendum must be a non-empty string.`);
            if (def.rewrite !== undefined && typeof def.rewrite !== "boolean") throw new Error(`variants.json ${name}: rewrite must be true or false.`);
            return [name, { addendum: def.addendum, rewrite: def.rewrite }];
        }),
    );
}

function makeVariant(name: string, def: VariantDef, extraPhrases: string[]): VariantFactory {
    return async (teamId) => {
        const { composeNodeA, composeNodeB, composeNodeC } = await import("../modules/email-campaigner/service/emailComposer");
        const { aiService, withPromptAddendum } = await import("../lib/aiService");
        const ask = (prompt: string) => aiService.askAI(prompt, teamId, { taskType: "EMAIL_REWRITE", surface: "EMAIL", expectsJson: true, disableGuardrails: true });
        const run = async (c: EvalCase): Promise<DraftCopy> => {
            // Copy the input: the composers add team memories to it.
            const input = structuredClone(c.input) as any;
            const out = c.node === "A" ? await composeNodeA(input, teamId) : c.node === "B" ? await composeNodeB(input, teamId) : await composeNodeC(input, teamId);
            const draft = { subject: out.subject, body: out.body };
            return def.rewrite ? (await rewriteDraft(draft, ask, { extraPhrases })).draft : draft;
        };
        return { id: name, generate: (c) => (def.addendum ? withPromptAddendum(def.addendum, () => run(c)) : run(c)) };
    };
}

async function main() {
    const dir = process.env["EVAL_DATA_DIR"];
    const data = loadEvalData(dir);

    const split = flag("split") ?? "dev";
    if (split !== "dev" && split !== "heldout") throw new Error("--split must be dev or heldout.");
    const max = flag("max-cases") !== undefined ? Number(flag("max-cases")) : undefined;
    if (max !== undefined && !(max > 0)) throw new Error("--max-cases must be a positive number.");
    let cases = data.cases.filter((c) => c.split === split);
    if (cases.length === 0) throw new Error(`No ${split} cases in cases.json.`);
    if (max) cases = cases.slice(0, max);

    // Each entry is "name" or "name@provider:model" (the latter pins the LLM for that variant).
    const names = (flag("variants") ?? "current").split(",").map((s) => s.trim()).filter(Boolean);
    const specs = names.map(parseVariantSpec);

    const slopFile = path.join(dir!, "slop.json");
    const extraPhrases = fs.existsSync(slopFile) ? parseExtraPhrases(JSON.parse(fs.readFileSync(slopFile, "utf8"))) : [];
    const variantsFile = path.join(dir!, "variants.json");
    const defs = { ...BUILT_IN, ...(fs.existsSync(variantsFile) ? parseVariantDefs(JSON.parse(fs.readFileSync(variantsFile, "utf8"))) : {}) };
    for (const s of specs) if (!defs[s.name]) throw new Error(`Unknown variant "${s.name}". Known: ${Object.keys(defs).join(", ")}.`);

    // The plan uses placeholder variants: it must not need a database or provider keys.
    const plan = abPlan(cases, names.map((id) => ({ id, generate: async () => ({ subject: "", body: "" }) })));
    // A rewrite pass adds one call per case, only for drafts that show a slop tell.
    const rewriteCalls = specs.filter((s) => defs[s.name]!.rewrite).length * cases.length;
    console.log(`A/B plan: ${plan.cases} ${split} cases x ${plan.variants} variants (${names.join(", ")}), ${plan.modelCalls} model calls${rewriteCalls ? `, plus up to ${rewriteCalls} for rewrite passes` : ""}.`);
    console.log(`Baseline: ${names[0]}. Private slop phrases: ${extraPhrases.length}.`);
    if (!process.argv.includes("--yes")) {
        console.log("Not run. Add --yes to spend credits and score.");
        return;
    }

    const teamId = process.env["EVAL_TEAM_ID"];
    if (!teamId) throw new Error("Set EVAL_TEAM_ID to the team whose provider keys the eval should use.");
    const { aiService, extractJsonBlock, withModelOverride } = await import("../lib/aiService");
    // The pin covers the variant's generation, including the composer's own critique. The judge below
    // is outside it, so every variant is judged by the same model.
    const variants = await Promise.all(
        specs.map(async (s, i): Promise<Variant> => {
            const base = await makeVariant(s.name, defs[s.name]!, extraPhrases)(teamId);
            const override = s.override;
            return { id: names[i]!, generate: override ? (c) => withModelOverride(override, () => base.generate(c)) : base.generate };
        }),
    );

    const judge = async (c: EvalCase, draft: DraftCopy, rubric: typeof data.rubric) => {
        const raw = await aiService.askAI(buildJudgePrompt(c, draft, rubric), teamId, {
            taskType: "CRITIQUE",
            surface: "EMAIL",
            expectsJson: true,
            disableGuardrails: true,
        });
        return parseJudgeReply(JSON.parse(extractJsonBlock(raw)), rubric);
    };

    const report = await runAb(cases, data.rubric, variants, { judge, slop: { extraPhrases } });

    let gitSha = "unknown";
    try {
        gitSha = execSync("git rev-parse --short HEAD", { encoding: "utf8" }).trim();
    } catch { /* not a checkout */ }
    const runsDir = path.join(dir!, "runs");
    fs.mkdirSync(runsDir, { recursive: true });
    const file = path.join(runsDir, `ab-${new Date().toISOString().replace(/[:.]/g, "-")}.json`);
    fs.writeFileSync(file, JSON.stringify({ gitSha, ranAt: new Date().toISOString(), split, prompts: allPromptRefs(), ...report }, null, 2));

    console.log(JSON.stringify({ variants: report.variants, comparisons: report.comparisons }, null, 2));
    console.log(`Full report: ${file}`);
}

main().catch((error) => {
    console.error(error?.message || error);
    process.exit(1);
});
