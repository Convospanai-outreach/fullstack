import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import ts from "typescript";
import { beforeEach, describe, expect, it, vi } from "vitest";

const { mockLogger } = vi.hoisted(() => ({ mockLogger: { error: vi.fn(), info: vi.fn(), warn: vi.fn() } }));
vi.mock("@/lib/logger", () => ({ logger: mockLogger }));

import { INTERNAL_ERROR_MESSAGE, internalErrorMessage } from "../internalError";

describe("internalErrorMessage", () => {
    beforeEach(() => vi.clearAllMocks());

    it("returns the fixed text, never the error's own message", () => {
        const error = new Error('relation "Team" does not exist');
        expect(internalErrorMessage(error)).toBe(INTERNAL_ERROR_MESSAGE);
        expect(internalErrorMessage(error, "Upload failed")).toBe("Upload failed");
    });

    it("logs the error's name, message and stack server-side", () => {
        const error = new TypeError("boom");
        internalErrorMessage(error, "Upload failed");
        expect(mockLogger.error).toHaveBeenCalledWith("[500] Upload failed", { name: "TypeError", message: "boom", stack: error.stack });
    });

    it("logs a non-Error value as a string", () => {
        internalErrorMessage("plain failure");
        expect(mockLogger.error).toHaveBeenCalledWith(`[500] ${INTERNAL_ERROR_MESSAGE}`, { error: "plain failure" });
    });
});

describe("structural guard: no 500 response carries the caught error", () => {
    const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../../../..");
    const roots = ["apps/api/routes", "apps/api/src", "apps/web/src/app/api"].map((dir) => path.join(repoRoot, dir));

    function sourceFiles(dir: string): string[] {
        return fs.readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
            const full = path.join(dir, entry.name);
            if (entry.isDirectory()) return ["node_modules", "__tests__", "dist"].includes(entry.name) ? [] : sourceFiles(full);
            return /\.tsx?$/.test(entry.name) && !/\.(test|spec)\./.test(entry.name) ? [full] : [];
        });
    }

    // True when `body` uses the caught error (or any `.message`) outside internalErrorMessage(...).
    function leaks(body: ts.Node, catchVar: string | null): boolean {
        let leak = false;
        const visit = (node: ts.Node) => {
            if (ts.isCallExpression(node) && ts.isIdentifier(node.expression) && node.expression.text === "internalErrorMessage") return;
            if (ts.isPropertyAccessExpression(node) && node.name.text === "message") leak = true;
            if (catchVar && ts.isIdentifier(node) && node.text === catchVar) {
                const parent = node.parent;
                const isKey = (ts.isPropertyAssignment(parent) && parent.name === node) || (ts.isPropertyAccessExpression(parent) && parent.name === node);
                if (!isKey) leak = true;
            }
            ts.forEachChild(node, visit);
        };
        visit(body);
        return leak;
    }

    it("returns a fixed message from every catch-block 500 (use internalErrorMessage)", () => {
        const sites: string[] = [];
        const offenders: string[] = [];
        for (const file of roots.flatMap(sourceFiles)) {
            const source = fs.readFileSync(file, "utf8");
            if (!source.includes("500")) continue;
            const sf = ts.createSourceFile(file, source, ts.ScriptTarget.Latest, true);
            const visit = (node: ts.Node) => {
                if ((ts.isCallExpression(node) || ts.isNewExpression(node)) && node.arguments && node.arguments.length >= 2) {
                    const callee = node.expression.getText(sf);
                    if (/^(NextResponse\.json|NextResponse|Response|Response\.json)$/.test(callee) && /\b500\b/.test(node.arguments[1].getText(sf))) {
                        let parent: ts.Node | undefined = node.parent;
                        while (parent && !ts.isCatchClause(parent)) parent = parent.parent;
                        if (parent && ts.isCatchClause(parent)) {
                            const site = `${path.relative(repoRoot, file)}:${sf.getLineAndCharacterOfPosition(node.getStart(sf)).line + 1}`;
                            sites.push(site);
                            const catchVar = parent.variableDeclaration ? parent.variableDeclaration.name.getText(sf) : null;
                            if (leaks(node.arguments[0], catchVar)) offenders.push(site);
                        }
                    }
                }
                ts.forEachChild(node, visit);
            };
            visit(sf);
        }
        // Guards against a bad path silently matching nothing.
        expect(sites.length).toBeGreaterThan(200);
        expect(offenders).toEqual([]);
    });
});
