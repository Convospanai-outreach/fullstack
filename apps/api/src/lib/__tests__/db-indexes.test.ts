import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

// roadmap 3.2 (I-09): structural guard for the composite indexes. The migration
// folder must be identical in all three Prisma trees (scripts/db/
// compare-prisma-schemas.mjs enforces that in CI), each file must hold exactly
// one CREATE INDEX CONCURRENTLY statement (it cannot run inside a transaction
// block, and Postgres runs a multi-statement query string as one implicit
// transaction), and each index must be declared in every schema copy under
// Prisma's default name so `prisma migrate diff` sees no drift.

const repoRoot = path.resolve(__dirname, "..", "..", "..", "..", "..");
const prismaTrees = ["packages/db/prisma", "apps/web/prisma", "apps/api/prisma"];

const INDEXES = [
    { migration: "20260926100000_lead_team_updated_at_index", model: "Lead", columns: ["teamId", "updatedAt"] },
    { migration: "20260926100100_activity_campaign_created_at_index", model: "Activity", columns: ["campaignId", "createdAt"] },
    { migration: "20260926100200_approval_request_team_status_index", model: "ApprovalRequest", columns: ["teamId", "status"] },
    { migration: "20260926100300_job_status_process_at_priority_index", model: "Job", columns: ["status", "processAt", "priority"] },
];

function read(relativePath: string): string {
    return fs.readFileSync(path.join(repoRoot, relativePath), "utf8").replace(/\r\n/g, "\n");
}

function sqlStatements(sql: string): string[] {
    return sql
        .split("\n")
        .filter((line) => !line.trim().startsWith("--"))
        .join("\n")
        .split(";")
        .map((statement) => statement.trim())
        .filter(Boolean);
}

function modelBlock(schema: string, model: string): string {
    const match = schema.match(new RegExp(`^model ${model} \\{\\n([\\s\\S]*?)^\\}`, "m"));
    if (!match) throw new Error(`model ${model} not found`);
    return match[1]!;
}

describe("roadmap 3.2 (I-09) composite index migrations", () => {
    for (const { migration, model, columns } of INDEXES) {
        const indexName = `${model}_${columns.join("_")}_idx`;
        const quotedColumns = columns.map((column) => `"${column}"`).join(", ");

        it(`${migration}: identical in all three Prisma trees`, () => {
            const copies = prismaTrees.map((tree) => read(`${tree}/migrations/${migration}/migration.sql`));
            expect(new Set(copies).size).toBe(1);
        });

        it(`${migration}: exactly one CREATE INDEX CONCURRENTLY IF NOT EXISTS "${indexName}"`, () => {
            const statements = sqlStatements(read(`apps/api/prisma/migrations/${migration}/migration.sql`));
            expect(statements).toEqual([
                `CREATE INDEX CONCURRENTLY IF NOT EXISTS "${indexName}" ON "${model}"(${quotedColumns})`,
            ]);
        });

        it(`${model}: @@index([${columns.join(", ")}]) is declared in every schema copy`, () => {
            for (const tree of prismaTrees) {
                const block = modelBlock(read(`${tree}/schema.prisma`), model);
                expect(block, tree).toMatch(new RegExp(`^\\s*@@index\\(\\[${columns.join(", ")}\\]\\)`, "m"));
            }
        });
    }
});
