import { PrismaClient } from "@prisma/client";
import { encryptCredential } from "../lib/security/credentialVault";
import { logger } from "../lib/logger";

const prisma = new PrismaClient();

/**
 * One-off backfill: encrypts Settings secrets that were stored as plaintext before
 * settingsService started encrypting on write. Idempotent (already-encrypted values
 * are skipped). Dry run unless --apply is passed. Needs ENCRYPTION_KEY.
 */

const SECRET_FIELDS = ["apiKeyOpenAI", "apiKeyGemini", "hubspotApiKey", "liCookie"] as const;

function isEncrypted(stored: string): boolean {
    try {
        const payload = JSON.parse(stored);
        return payload?.v === 1 && !!payload.cipher && !!payload.iv && !!payload.tag;
    } catch {
        return false;
    }
}

async function main() {
    const apply = process.argv.includes("--apply");
    const rows = await prisma.settings.findMany({
        where: { OR: SECRET_FIELDS.map((field) => ({ [field]: { not: null } })) },
        select: { id: true, apiKeyOpenAI: true, apiKeyGemini: true, hubspotApiKey: true, liCookie: true },
    });

    let rowsToUpdate = 0;
    let fieldsToEncrypt = 0;
    for (const row of rows) {
        const data: Record<string, string> = {};
        for (const field of SECRET_FIELDS) {
            const stored = row[field];
            if (stored && !isEncrypted(stored)) {
                data[field] = JSON.stringify(await encryptCredential(stored));
            }
        }
        const count = Object.keys(data).length;
        if (count === 0) continue;
        rowsToUpdate++;
        fieldsToEncrypt += count;
        if (apply) await prisma.settings.update({ where: { id: row.id }, data });
    }

    logger.info(`${apply ? "Encrypted" : "Would encrypt"} ${fieldsToEncrypt} plaintext secret(s) across ${rowsToUpdate} of ${rows.length} Settings row(s).${apply ? "" : " Re-run with --apply to write."}`);
}

main()
    .catch((error) => {
        logger.error("Settings secret backfill failed", error);
        process.exitCode = 1;
    })
    .finally(() => prisma.$disconnect());
