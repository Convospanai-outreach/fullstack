import fs from "node:fs";
import path from "node:path";

const projectRoot = process.cwd();
const scanRoot = path.join(projectRoot, "apps/web/src");

// Server-only library/service files that legitimately use @prisma/client directly
const allowed = new Set([
  path.normalize("apps/web/src/lib/db.ts"),
  path.normalize("apps/web/src/lib/db-replica.ts"),
  path.normalize("apps/web/src/lib/dbFactory.ts"),
  path.normalize("apps/web/src/lib/queue.ts"),
  path.normalize("apps/web/src/lib/permissions.ts"),
  path.normalize("apps/web/src/lib/identity/IdentityService.ts"),
  path.normalize("apps/web/src/lib/ai/HybridRouter.ts"),
  path.normalize("apps/web/src/modules/caller/CallerService.ts"),
  path.normalize("apps/web/src/modules/compliance/ResidencyLockService.ts"),
  path.normalize("apps/web/src/modules/contract/contractResolver.ts"),
  path.normalize("apps/web/src/modules/conversation/ConversationService.ts"),
  path.normalize("apps/web/src/modules/icp-builder/service/icpService.ts"),
  path.normalize("apps/web/src/modules/learning/EventStore.ts"),
  path.normalize("apps/web/src/modules/search/service/SearchService.ts"),
  path.normalize("apps/web/src/modules/training/SyntheticDataService.ts"),
  path.normalize("apps/web/src/scripts/archive-audit-logs.ts"),
  path.normalize("apps/web/src/scripts/seed-marketplace.ts"),
  path.normalize("apps/web/src/scripts/seed-readiness.ts"),
  path.normalize("apps/web/src/scripts/setup-enterprise-pilot.ts"),
  path.normalize("apps/web/src/scripts/test-caller-flow.ts"),
  path.normalize("apps/web/src/scripts/test-conversation-flow.ts"),
  path.normalize("apps/web/src/scripts/test-hybrid-ai.ts"),
  path.normalize("apps/web/src/scripts/validate-production-readiness.ts"),
]);

const bad = [];

function walk(dir) {
  if (!fs.existsSync(dir)) {
    console.error(`Scan root not found: ${dir}`);
    process.exit(1);
  }

  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);

    if (entry.isDirectory()) {
      walk(full);
      continue;
    }

    if (!/\.(ts|tsx)$/.test(entry.name)) continue;

    const projectRel = path.normalize(path.relative(projectRoot, full));
    const text = fs.readFileSync(full, "utf8");

    const importsPrisma =
      text.includes("from '@prisma/client'") ||
      text.includes('from "@prisma/client"');

    if (importsPrisma && !allowed.has(projectRel)) {
      bad.push(projectRel);
    }
  }
}

walk(scanRoot);

if (bad.length) {
  console.error("");
  console.error("Forbidden @prisma/client imports found in apps/web (UI/component files):");
  for (const file of bad) console.error(`- ${file}`);
  console.error("");
  console.error("Do not import Prisma model/enum exports into React components or shared frontend files.");
  console.error("Use frontend-safe DTO/type files instead, for example apps/web/src/types/*.ts.");
  console.error("");
  process.exit(1);
}

console.log("No forbidden @prisma/client imports found in apps/web.");
