/**
 * One-off cutover script: pushes every currently-published LandingPage into
 * Cloudflare KV so the Cloudflare Worker (workers/landing-pages) can start
 * serving them immediately, without waiting for each page to be re-published.
 *
 * Run: npx tsx src/scripts/backfill-cloudflare-landing-pages.ts
 */
import { prisma } from "../lib/db";
import { cloudflarePagesService } from "../modules/landing-agent/service/cloudflarePagesService";

async function main() {
    const pages = await prisma.landingPage.findMany({
        where: { status: "published" },
        select: { id: true, slug: true },
    });

    console.log(`Found ${pages.length} published landing page(s) to backfill.`);

    let pushed = 0;
    let skipped = 0;
    let failed = 0;

    for (const page of pages) {
        const result = await cloudflarePagesService.publishPageToCloudflare(page.id);
        if (result.status === "pushed") {
            pushed++;
            console.log(`  ok    ${page.slug}`);
        } else if (result.status === "skipped") {
            skipped++;
            console.log(`  skip  ${page.slug} (${result.details})`);
        } else {
            failed++;
            console.error(`  FAIL  ${page.slug}: ${result.details}`);
        }
    }

    console.log(`Done. pushed=${pushed} skipped=${skipped} failed=${failed}`);
    if (failed > 0) process.exitCode = 1;
}

main()
    .catch((error) => {
        console.error("Backfill script crashed:", error);
        process.exitCode = 1;
    })
    .finally(() => prisma.$disconnect());
