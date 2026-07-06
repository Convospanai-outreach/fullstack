import { execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import process from "node:process";

type Severity = "critical" | "high" | "medium";

type PatternRule = {
  id: string;
  label: string;
  regex: RegExp;
  severity: Severity;
};

type AllowlistEntry = {
  path: string;
  patternId: string;
  reason: string;
  ticket?: string;
};

type Finding = {
  filePath: string;
  lineNumber: number;
  patternId: string;
  patternLabel: string;
  severity: Severity;
  excerpt: string;
  allowlisted: boolean;
  allowlistReason?: string;
  allowlistTicket?: string;
};

const repoRoot = process.cwd();
const migrationGlobs = [
  "apps/web/prisma/migrations/*/migration.sql",
  "apps/api/prisma/migrations/*/migration.sql",
  "packages/db/prisma/migrations/*/migration.sql",
];

const patternRules: PatternRule[] = [
  {
    id: "DELETE_FROM",
    label: "DELETE FROM",
    regex: /\bDELETE\s+FROM\b/i,
    severity: "critical",
  },
  {
    id: "TRUNCATE",
    label: "TRUNCATE",
    regex: /\bTRUNCATE\b/i,
    severity: "critical",
  },
  {
    id: "DROP_TABLE",
    label: "DROP TABLE",
    regex: /\bDROP\s+TABLE\b/i,
    severity: "critical",
  },
  {
    id: "DROP_COLUMN",
    label: "DROP COLUMN",
    regex: /\bDROP\s+COLUMN\b/i,
    severity: "high",
  },
  {
    id: "DROP_INDEX",
    label: "DROP INDEX",
    regex: /\bDROP\s+INDEX\b/i,
    severity: "medium",
  },
  {
    id: "DROP_CONSTRAINT",
    label: "DROP CONSTRAINT",
    regex: /\bDROP\s+CONSTRAINT\b/i,
    severity: "medium",
  },
  {
    id: "ALTER_TABLE_DROP",
    label: "ALTER TABLE ... DROP",
    regex: /\bALTER\s+TABLE\b.*\bDROP\b/i,
    severity: "medium",
  },
];

function parseAllowlistPath(argv: string[]): string {
  const flag = argv.find((arg) => arg.startsWith("--allowlist="));
  if (flag) {
    return path.resolve(repoRoot, flag.slice("--allowlist=".length));
  }

  return path.resolve(repoRoot, "scripts/readiness/destructive-migration-allowlist.json");
}

function loadAllowlist(filePath: string): AllowlistEntry[] {
  if (!fs.existsSync(filePath)) {
    return [];
  }

  const raw = fs.readFileSync(filePath, "utf8");
  const parsed = JSON.parse(raw);
  if (!Array.isArray(parsed)) {
    throw new Error(`Allowlist file must contain a JSON array: ${filePath}`);
  }

  return parsed.map((entry) => {
    if (
      !entry ||
      typeof entry.path !== "string" ||
      typeof entry.patternId !== "string" ||
      typeof entry.reason !== "string"
    ) {
      throw new Error(
        `Invalid allowlist entry in ${filePath}. Expected { path, patternId, reason, ticket? }.`,
      );
    }

    return {
      path: normalizePath(entry.path),
      patternId: entry.patternId,
      reason: entry.reason,
      ticket: typeof entry.ticket === "string" ? entry.ticket : undefined,
    };
  });
}

function normalizePath(input: string): string {
  return input.replace(/\\/g, "/");
}

function listTrackedMigrationFiles(): string[] {
  const output = execFileSync("git", ["ls-files", ...migrationGlobs], {
    cwd: repoRoot,
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
  });

  return output
    .split(/\r?\n/u)
    .map((line) => line.trim())
    .filter(Boolean)
    .map(normalizePath)
    .sort((left, right) => left.localeCompare(right));
}

function findAllowlistEntry(
  allowlist: AllowlistEntry[],
  filePath: string,
  patternId: string,
): AllowlistEntry | undefined {
  return allowlist.find((entry) => entry.path === filePath && entry.patternId === patternId);
}

function scanFile(filePath: string, allowlist: AllowlistEntry[]): Finding[] {
  const absolutePath = path.resolve(repoRoot, filePath);
  const lines = fs.readFileSync(absolutePath, "utf8").split(/\r?\n/u);
  const findings: Finding[] = [];

  lines.forEach((line, index) => {
    const matchedRules = patternRules.filter((rule) => rule.regex.test(line));
    const shouldSuppressGenericAlterTableDrop =
      matchedRules.some((rule) => rule.id === "ALTER_TABLE_DROP") &&
      matchedRules.some((rule) => rule.id === "DROP_COLUMN" || rule.id === "DROP_CONSTRAINT");

    matchedRules.forEach((rule) => {
      if (rule.id === "ALTER_TABLE_DROP" && shouldSuppressGenericAlterTableDrop) {
        return;
      }

      const allowlistEntry = findAllowlistEntry(allowlist, filePath, rule.id);
      findings.push({
        filePath,
        lineNumber: index + 1,
        patternId: rule.id,
        patternLabel: rule.label,
        severity: rule.severity,
        excerpt: line.trim(),
        allowlisted: Boolean(allowlistEntry),
        allowlistReason: allowlistEntry?.reason,
        allowlistTicket: allowlistEntry?.ticket,
      });
    });
  });

  return findings;
}

function printReport(files: string[], findings: Finding[], allowlistPath: string, allowlistUsed: boolean) {
  console.log("Destructive Prisma migration scan");
  console.log(`Repository root: ${repoRoot}`);
  console.log(`Tracked migration SQL files scanned: ${files.length}`);
  console.log(`Allowlist file: ${allowlistPath}${allowlistUsed ? "" : " (not present)"}`);
  console.log("");

  if (findings.length === 0) {
    console.log("No destructive SQL patterns detected.");
    return;
  }

  findings.forEach((finding) => {
    console.log(
      [
        `[${finding.severity.toUpperCase()}]`,
        `${finding.filePath}:${finding.lineNumber}`,
        `pattern=${finding.patternId}`,
        `match=${JSON.stringify(finding.patternLabel)}`,
      ].join(" "),
    );
    console.log(`  excerpt: ${finding.excerpt}`);
    if (finding.allowlisted) {
      const ticketSuffix = finding.allowlistTicket ? ` ticket=${finding.allowlistTicket}` : "";
      console.log(`  allowlist: ${finding.allowlistReason}${ticketSuffix}`);
    }
  });

  const summary = findings.reduce<Record<Severity, number>>(
    (acc, finding) => {
      acc[finding.severity] += 1;
      return acc;
    },
    { critical: 0, high: 0, medium: 0 },
  );

  const blockingCount = findings.filter((finding) => !finding.allowlisted).length;
  console.log("");
  console.log(
    `Summary: ${findings.length} findings (${summary.critical} critical, ${summary.high} high, ${summary.medium} medium); ${blockingCount} blocking after allowlist evaluation.`,
  );
}

function main() {
  const allowlistPath = parseAllowlistPath(process.argv.slice(2));
  const allowlist = loadAllowlist(allowlistPath);
  const allowlistUsed = fs.existsSync(allowlistPath);
  const files = listTrackedMigrationFiles();

  if (files.length === 0) {
    console.error("No tracked Prisma migration SQL files found.");
    process.exit(1);
  }

  const findings = files.flatMap((filePath) => scanFile(filePath, allowlist));
  printReport(files, findings, allowlistPath, allowlistUsed);

  const blockingFindings = findings.filter((finding) => !finding.allowlisted);
  if (blockingFindings.length > 0) {
    process.exit(1);
  }
}

main();
