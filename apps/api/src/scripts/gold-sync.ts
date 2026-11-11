import { prisma } from "../lib/db";
import { loadGold, summarizeGold, syncGold } from "../modules/gold/goldSet";

// npm run gold:sync -- [--yes]
//
// Loads the private gold set from GOLD_DIR (outside the checkout). Only the few-shot examples are
// stored, in the "CMF Gold Set" knowledge base of GOLD_TEAM_ID; held-out examples stay in the folder.
// Without --yes it only prints what would change; with it, new and changed examples are embedded
// (one embedding call each, billed to that team).

async function main() {
    const dir = process.env["GOLD_DIR"];
    const teamId = process.env["GOLD_TEAM_ID"];
    if (!dir) throw new Error("Set GOLD_DIR to the private folder holding gold.json.");
    if (!teamId) throw new Error("Set GOLD_TEAM_ID to the platform team that owns the gold knowledge base.");

    const all = loadGold(dir);
    const summary = summarizeGold(all);
    console.log(`Gold set: ${summary.total} examples (few-shot ${summary.fewshot}, held out ${summary.heldout}; A ${summary.byNode.A}, B ${summary.byNode.B}, C ${summary.byNode.C}).`);
    if (summary.warning) console.warn(`Warning: ${summary.warning}`);

    const result = await syncGold(all.filter((e) => e.split === "fewshot"), teamId, { dryRun: !process.argv.includes("--yes") });
    console.log(`Few-shot: unchanged ${result.unchanged}, to add ${result.toAdd.length}, to remove ${result.toRemove.length}.`);
    if (result.dryRun) console.log("Not written. Add --yes to embed and store.");
    else console.log(`Added ${result.added}, removed ${result.removed}, failed ${result.failed}.`);
    if (result.failed > 0) process.exitCode = 1;
}

main()
    .catch((error) => {
        console.error(error?.message || error);
        process.exitCode = 1;
    })
    .finally(() => prisma.$disconnect());
