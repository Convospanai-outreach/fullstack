import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { beforeEach, describe, expect, it, vi } from "vitest";

const { mockPrisma, mockEmbed } = vi.hoisted(() => ({
    mockPrisma: {
        knowledgeBase: { findFirst: vi.fn(), create: vi.fn() },
        knowledgeItem: { findMany: vi.fn(), create: vi.fn(), delete: vi.fn(), deleteMany: vi.fn() },
        $executeRawUnsafe: vi.fn(),
        $queryRawUnsafe: vi.fn(),
    },
    mockEmbed: vi.fn(),
}));

vi.mock("@/lib/db", () => ({ prisma: mockPrisma }));
vi.mock("@/lib/logger", () => ({ logger: { warn: vi.fn(), info: vi.fn(), error: vi.fn() } }));
vi.mock("@/lib/aiService", () => ({ aiService: { getRagEmbedding: mockEmbed } }));

import { chunkMarkdown } from "./chunkPlaybook";
import { PLAYBOOK_KB_NAME, planSync, readPlaybookChunks, searchPlaybook, syncPlaybook } from "./playbookStore";

// Placeholder text only: the real playbook is private and never lives in the repo.
const doc = `# Alpha
intro line that is long enough to keep

## Beta
body of beta that is long enough to keep

### Gamma
body of gamma that is long enough to keep

## Delta
tiny
`;

describe("chunkMarkdown", () => {
    it("carries the heading path and drops sections with almost no text", () => {
        const chunks = chunkMarkdown("a.md", doc);
        expect(chunks.map((c) => c.heading)).toEqual(["Alpha", "Alpha > Beta", "Alpha > Beta > Gamma"]);
        expect(chunks[2].text).toBe("Alpha > Beta > Gamma\nbody of gamma that is long enough to keep");
    });

    it("gives the same hash for the same text and a new one when text or place changes", () => {
        const [a] = chunkMarkdown("a.md", doc);
        expect(chunkMarkdown("a.md", doc)[0].hash).toBe(a.hash);
        expect(chunkMarkdown("b.md", doc)[0].hash).not.toBe(a.hash);
        expect(chunkMarkdown("a.md", doc.replace("intro", "outro"))[0].hash).not.toBe(a.hash);
    });

    it("packs paragraphs under the size limit and cuts an over-long one", () => {
        const long = `# T\n${"word ".repeat(100)}\n\n${"x".repeat(250)}`;
        const chunks = chunkMarkdown("a.md", long, 300);
        expect(chunks.length).toBeGreaterThan(1);
        expect(chunks.every((c) => c.text.length <= 300 + "T\n".length)).toBe(true);
    });

    it("does not treat a # line inside a code fence as a heading", () => {
        const chunks = chunkMarkdown("a.md", "# Top\n```\n# not a heading\nsome code that is long enough\n```\n");
        expect(chunks.map((c) => c.heading)).toEqual(["Top"]);
    });

    it("handles skipped heading levels and CRLF", () => {
        const chunks = chunkMarkdown("a.md", "### Deep\r\nbody that is long enough to keep here\r\n");
        expect(chunks[0].heading).toBe("Deep");
    });
});

describe("readPlaybookChunks", () => {
    it("reads md and txt files recursively, ignores other files, and refuses a folder inside the repo", () => {
        const dir = fs.mkdtempSync(path.join(os.tmpdir(), "playbook-"));
        fs.mkdirSync(path.join(dir, "sub"));
        fs.writeFileSync(path.join(dir, "one.md"), "# One\nbody that is long enough to keep");
        fs.writeFileSync(path.join(dir, "sub", "two.txt"), "plain text that is long enough to keep");
        fs.writeFileSync(path.join(dir, "skip.json"), "{}");

        const chunks = readPlaybookChunks(dir, path.join(os.tmpdir(), "no-such-repo"));
        expect(chunks.map((c) => c.file)).toEqual(["one.md", "sub/two.txt"]);
        expect(() => readPlaybookChunks(dir, dir)).toThrow(/inside the repository/);
        fs.rmSync(dir, { recursive: true });
    });

    it("errors when the folder has no playbook text", () => {
        const dir = fs.mkdtempSync(path.join(os.tmpdir(), "playbook-empty-"));
        expect(() => readPlaybookChunks(dir, path.join(os.tmpdir(), "no-such-repo"))).toThrow(/No playbook text/);
        fs.rmSync(dir, { recursive: true });
    });
});

describe("planSync", () => {
    const chunks = chunkMarkdown("a.md", doc);

    it("adds new chunks, removes gone or unhashed items, and counts unchanged", () => {
        const plan = planSync(chunks, [
            { id: "keep", hash: chunks[0].hash },
            { id: "gone", hash: "old" },
            { id: "unhashed", hash: null },
        ]);
        expect(plan.toAdd.map((c) => c.hash)).toEqual([chunks[1].hash, chunks[2].hash]);
        expect(plan.toRemove).toEqual(["gone", "unhashed"]);
        expect(plan.unchanged).toBe(1);
    });
});

describe("syncPlaybook", () => {
    const chunks = chunkMarkdown("a.md", doc);

    beforeEach(() => {
        vi.clearAllMocks();
        mockPrisma.knowledgeBase.findFirst.mockResolvedValue({ id: "kb1" });
        mockPrisma.knowledgeItem.findMany.mockResolvedValue([]);
        mockPrisma.knowledgeItem.create.mockResolvedValue({ id: "item" });
        mockPrisma.knowledgeItem.deleteMany.mockResolvedValue({ count: 0 });
        mockEmbed.mockResolvedValue([0.1, 0.2]);
    });

    it("a dry run reads and plans but writes and embeds nothing, even when the knowledge base is missing", async () => {
        mockPrisma.knowledgeBase.findFirst.mockResolvedValue(null);

        const result = await syncPlaybook(chunks, "team1", { dryRun: true });

        expect(result).toMatchObject({ dryRun: true, added: 0 });
        expect(result.toAdd).toHaveLength(3);
        expect(mockPrisma.knowledgeBase.create).not.toHaveBeenCalled();
        expect(mockEmbed).not.toHaveBeenCalled();
        expect(mockPrisma.knowledgeItem.create).not.toHaveBeenCalled();
    });

    it("creates the knowledge base, embeds and stores each new chunk with its hash", async () => {
        mockPrisma.knowledgeBase.findFirst.mockResolvedValue(null);
        mockPrisma.knowledgeBase.create.mockResolvedValue({ id: "kb1" });

        const result = await syncPlaybook(chunks, "team1", { dryRun: false });

        expect(mockPrisma.knowledgeBase.create).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ teamId: "team1", name: PLAYBOOK_KB_NAME }) }));
        expect(mockEmbed).toHaveBeenCalledTimes(3);
        expect(mockPrisma.knowledgeItem.create).toHaveBeenCalledWith(
            expect.objectContaining({ data: expect.objectContaining({ knowledgeBaseId: "kb1", metadata: expect.objectContaining({ source: "playbook", hash: chunks[0].hash }) }) }),
        );
        expect(result).toMatchObject({ added: 3, failed: 0 });
    });

    it("drops a chunk that could not be embedded so the next sync retries it, and keeps going", async () => {
        mockEmbed.mockRejectedValueOnce(new Error("no key")).mockResolvedValue([0.1]);
        mockPrisma.$executeRawUnsafe.mockResolvedValueOnce(1).mockRejectedValueOnce(new Error("db")).mockResolvedValue(1);

        const result = await syncPlaybook(chunks, "team1", { dryRun: false });

        // First fails at embedding (nothing stored), second fails storing the vector (item deleted again).
        expect(mockPrisma.knowledgeItem.delete).toHaveBeenCalledTimes(1);
        expect(result).toMatchObject({ added: 1, failed: 2 });
    });

    it("removes changed or gone items only after the additions, scoped to this knowledge base", async () => {
        mockPrisma.knowledgeItem.findMany.mockResolvedValue([{ id: "old", metadata: { hash: "stale" } }]);
        mockPrisma.knowledgeItem.deleteMany.mockResolvedValue({ count: 1 });

        const result = await syncPlaybook(chunks, "team1", { dryRun: false });

        expect(mockPrisma.knowledgeItem.deleteMany).toHaveBeenCalledWith({ where: { id: { in: ["old"] }, knowledgeBaseId: "kb1" } });
        expect(mockPrisma.knowledgeItem.create.mock.invocationCallOrder[0]).toBeLessThan(mockPrisma.knowledgeItem.deleteMany.mock.invocationCallOrder[0]);
        expect(result.removed).toBe(1);
    });
});

describe("searchPlaybook", () => {
    beforeEach(() => {
        vi.clearAllMocks();
        mockEmbed.mockResolvedValue([0.1, 0.2]);
    });

    it("returns nothing for an empty query or no team, without calling anything", async () => {
        expect(await searchPlaybook("  ", "team1")).toEqual([]);
        expect(await searchPlaybook("q", undefined)).toEqual([]);
        expect(mockEmbed).not.toHaveBeenCalled();
    });

    it("searches only the playbook knowledge base of that team, clamps the limit and applies the floor", async () => {
        mockPrisma.$queryRawUnsafe.mockResolvedValue([
            { id: "1", content: "c1", metadata: { heading: "H", file: "f.md" }, similarity: "0.8" },
            { id: "2", content: "c2", metadata: null, similarity: 0.2 },
        ]);

        const hits = await searchPlaybook("how to open", "team1", { limit: 999, minSimilarity: 0.5 });

        expect(mockPrisma.$queryRawUnsafe.mock.calls[0].slice(2)).toEqual(["team1", PLAYBOOK_KB_NAME, 20]);
        expect(hits).toEqual([{ id: "1", content: "c1", heading: "H", file: "f.md", similarity: 0.8 }]);
    });

    it("fails open: a search error returns no context", async () => {
        mockPrisma.$queryRawUnsafe.mockRejectedValue(new Error("db down"));
        expect(await searchPlaybook("q", "team1")).toEqual([]);
    });
});
