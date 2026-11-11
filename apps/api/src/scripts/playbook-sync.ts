import { prisma } from "../lib/db";
import { readPlaybookChunks, syncPlaybook } from "../modules/playbook/playbookStore";

// npm run playbook:sync -- [--yes]
//
// Loads the private playbook from PLAYBOOK_DIR (outside the checkout) into the "CMF Playbook"
// knowledge base of PLAYBOOK_TEAM_ID. Without --yes it only prints what would change; with it,
// new and changed chunks are embedded (one embedding call each, billed to that team).

async function main() {
    const dir = process.env["PLAYBOOK_DIR"];
    const teamId = process.env["PLAYBOOK_TEAM_ID"];
    if (!dir) throw new Error("Set PLAYBOOK_DIR to the private folder holding the playbook (.md or .txt files).");
    if (!teamId) throw new Error("Set PLAYBOOK_TEAM_ID to the platform team that owns the playbook knowledge base.");

    const chunks = readPlaybookChunks(dir);
    const result = await syncPlaybook(chunks, teamId, { dryRun: !process.argv.includes("--yes") });

    console.log(`Playbook: ${chunks.length} chunks. Unchanged ${result.unchanged}, to add ${result.toAdd.length}, to remove ${result.toRemove.length}.`);
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
