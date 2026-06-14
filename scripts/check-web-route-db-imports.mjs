import fs from "node:fs";
import path from "node:path";

const projectRoot = process.cwd();
const scanRoot = path.join(projectRoot, "apps/web/src/app");
const bad = [];

const staticDbImportPattern =
  /import\s+(?:type\s+)?(?:[\s\S]*?)\s+from\s+["']@\/lib\/db["'];?/g;

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

    if (entry.name !== "route.ts") continue;

    const text = fs.readFileSync(full, "utf8");
    if (!staticDbImportPattern.test(text)) continue;

    bad.push(path.normalize(path.relative(projectRoot, full)));
  }
}

walk(scanRoot);

if (bad.length) {
  console.error("");
  console.error("Static @/lib/db imports found in web route handlers:");
  for (const file of bad) console.error(`- ${file}`);
  console.error("");
  console.error("Route modules may be imported during Next.js build.");
  console.error("Use a request-time import inside the handler instead:");
  console.error('  const { prisma } = await import("@/lib/db");');
  console.error("");
  process.exit(1);
}

console.log("No static @/lib/db imports found in web route handlers.");
