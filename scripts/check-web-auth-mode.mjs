import fs from "node:fs";
import path from "node:path";

const root = process.cwd();

function read(relPath) {
  return fs.readFileSync(path.join(root, relPath), "utf8");
}

const checks = [
  {
    name: "ClerkProvider is mounted in app layout",
    file: "apps/web/src/app/layout.tsx",
    test: (text) => text.includes("<ClerkProvider"),
  },
  {
    name: "Clerk user sync endpoint exists",
    file: "apps/web/src/app/api/auth/clerk-sync/route.ts",
    test: (text) => text.includes("findOrCreateClerkAppUser"),
  },
  {
    name: "Password signup endpoint is disabled",
    file: "apps/web/src/app/api/register/route.ts",
    test: (text) => text.includes("status: 410") && text.includes("Password signup is disabled"),
  },
  {
    name: "NextAuth has no direct providers by design",
    file: "apps/web/src/lib/auth.ts",
    test: (text) =>
      text.includes("Clerk is the primary signup/sign-in provider") &&
      /providers:\s*\[\]/.test(text),
  },
];

const failures = [];

for (const check of checks) {
  const fullPath = path.join(root, check.file);
  if (!fs.existsSync(fullPath)) {
    failures.push(`${check.name}: missing ${check.file}`);
    continue;
  }

  const text = read(check.file);
  if (!check.test(text)) {
    failures.push(`${check.name}: failed in ${check.file}`);
  }
}

if (failures.length) {
  console.error("");
  console.error("Web auth mode guard failed:");
  for (const failure of failures) console.error(`- ${failure}`);
  console.error("");
  console.error("Expected mode: Clerk handles signup/sign-in; Postgres stores synced app users; NextAuth is legacy session fallback only.");
  process.exit(1);
}

console.log("Web auth mode guard passed: Clerk-first auth is explicit and password signup is disabled.");
