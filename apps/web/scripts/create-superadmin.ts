/**
 * Bootstraps (or resets) the first superadmin credential. Run locally - never
 * pastes the plaintext password anywhere but this terminal - then run the
 * printed SQL yourself against production (this repo's convention: secrets
 * and prod writes are handed to the operator, not executed by the agent).
 *
 * Usage:
 *   npx tsx scripts/create-superadmin.ts <email> <password>
 *
 * The email must already belong to an existing User row (sign up / log in
 * with Google once first if it doesn't) - this only attaches a separate,
 * non-OAuth password credential to that account for /superadmin access.
 */
import { randomUUID } from "crypto";
import { hashSuperAdminPassword } from "../src/lib/superadmin/crypto";

async function main() {
    const [email, password] = process.argv.slice(2);
    if (!email || !password) {
        console.error("Usage: npx tsx scripts/create-superadmin.ts <email> <password>");
        process.exit(1);
    }
    if (password.length < 12) {
        console.error("Password must be at least 12 characters.");
        process.exit(1);
    }

    const passwordHash = await hashSuperAdminPassword(password);
    const id = randomUUID();
    const now = new Date().toISOString();

    console.log("\nRun this against the production database (Supabase SQL editor or psql):\n");
    console.log(`INSERT INTO "SuperAdminCredential" (id, "userId", "passwordHash", "failedAttempts", "createdAt", "updatedAt")
SELECT '${id}', id, '${passwordHash}', 0, '${now}', '${now}'
FROM "User" WHERE email = '${email.replace(/'/g, "''")}'
ON CONFLICT ("userId") DO UPDATE SET
  "passwordHash" = EXCLUDED."passwordHash",
  "failedAttempts" = 0,
  "lockedUntil" = NULL,
  "updatedAt" = EXCLUDED."updatedAt";\n`);
    console.log(`If that returns 0 rows affected, no User row exists for ${email} yet - sign up/log in with that email first, then re-run this script.`);
}

main();
