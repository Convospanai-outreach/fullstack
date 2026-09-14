import fs from "node:fs";
import path from "node:path";

const root = process.cwd();

function read(relPath) {
  return fs.readFileSync(path.join(root, relPath), "utf8");
}

const checks = [
  {
    name: "ClerkProvider is not mounted in app layout",
    file: "apps/web/src/app/layout.tsx",
    test: (text) => !text.includes("ClerkProvider"),
  },
  {
    name: "Clerk user sync endpoint has been removed",
    file: "apps/web/src/app/api/auth/clerk-sync/route.ts",
    test: () => false,
    invert: true,
  },
  {
    name: "Password signup endpoint is disabled",
    file: "apps/web/src/app/api/register/route.ts",
    test: (text) => text.includes("status: 410") && text.includes("Password signup is disabled"),
  },
  {
    name: "NextAuth exposes the Google provider",
    file: "apps/web/src/lib/auth.ts",
    test: (text) => text.includes("GoogleProvider("),
  },
];

const failures = [];

for (const check of checks) {
  const fullPath = path.join(root, check.file);
  const exists = fs.existsSync(fullPath);

  if (check.invert) {
    // This file is expected to be gone - Clerk's user-sync endpoint has no
    // NextAuth/Google equivalent, it was deleted outright.
    if (exists) {
      failures.push(`${check.name}: ${check.file} still exists`);
    }
    continue;
  }

  if (!exists) {
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
  console.error("Expected mode: Google OAuth via NextAuth is the sole sign-in path (open signup, no Clerk); password signup is disabled.");
  process.exit(1);
}

console.log("Web auth mode guard passed: Google-only auth is explicit and password signup is disabled.");
