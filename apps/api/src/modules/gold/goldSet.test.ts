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

import { GOLD_KB_NAME, loadGold, parseGold, searchGold, situationText, summarizeGold, syncGold, type GoldExample } from "./goldSet";

// Placeholder text only: the real gold set is private and never lives in the repo.
const example = (id: string, split: "fewshot" | "heldout", signal = id): GoldExample => ({
    id, node: "A", split,
    input: { prospect_name: "P", pain_context: `pain ${signal}`, signal_type: "sig", extracted_signal: `signal ${signal}`, sender_name: "S" },
    subject: `subject ${id}`, body: `body ${id}`,
});

describe("situationText", () => {
    it("uses the situation fields only, not names, emails or style", () => {
        const text = situationText({ prospect_name: "Jane", sender_email: "a@b.c", tone: "warm", pain_context: " pain ", hypothesis: "hyp" });
        expect(text).toBe("pain_context: pain\nhypothesis: hyp");
    });
});

describe("parseGold", () => {
    it("accepts valid examples and trims text", () => {
        const [e] = parseGold([{ ...example("a", "fewshot"), subject: "  s  ", notes: "  n " }]);
        expect(e).toMatchObject({ subject: "s", notes: "n" });
    });

    it("rejects missing or bad fields, duplicate ids and inputs with no situation", () => {
        expect(() => parseGold([])).toThrow(/non-empty/);
        expect(() => parseGold([example("a", "fewshot"), example("a", "fewshot", "x")])).toThrow(/duplicate/);
        expect(() => parseGold([{ ...example("a", "fewshot"), node: "Z" }])).toThrow(/node/);
        expect(() => parseGold([{ ...example("a", "fewshot"), split: "train" }])).toThrow(/split/);
        expect(() => parseGold([{ ...example("a", "fewshot"), body: " " }])).toThrow(/body/);
        expect(() => parseGold([{ ...example("a", "fewshot"), input: { prospect_name: "P" } }])).toThrow(/situation fields/);
    });

    it("refuses a held-out example whose situation is also a few-shot one", () => {
        expect(() => parseGold([example("a", "fewshot", "same"), example("b", "heldout", "same")])).toThrow(/leak/);
        expect(() => parseGold([example("a", "fewshot", "one"), example("b", "heldout", "two")])).not.toThrow();
    });
});

describe("summarizeGold", () => {
    it("counts splits and nodes, and warns when held-out is far from about 20%", () => {
        const ok = Array.from({ length: 10 }, (_, i) => example(`e${i}`, i < 8 ? "fewshot" : "heldout"));
        expect(summarizeGold(ok)).toMatchObject({ total: 10, fewshot: 8, heldout: 2, warning: null });
        const none = Array.from({ length: 10 }, (_, i) => example(`e${i}`, "fewshot"));
        expect(summarizeGold(none).warning).toMatch(/0%/);
        expect(summarizeGold([example("a", "fewshot")]).warning).toBeNull();
    });
});

describe("loadGold", () => {
    it("needs GOLD_DIR, refuses a folder inside the repo, and reads gold.json", () => {
        expect(() => loadGold(undefined)).toThrow(/GOLD_DIR/);
        const dir = fs.mkdtempSync(path.join(os.tmpdir(), "gold-"));
        fs.writeFileSync(path.join(dir, "gold.json"), JSON.stringify([example("a", "fewshot")]));
        expect(loadGold(dir, path.join(os.tmpdir(), "no-such-repo"))).toHaveLength(1);
        expect(() => loadGold(dir, dir)).toThrow(/inside the repository/);
        expect(() => loadGold(path.join(dir, "missing"), path.join(os.tmpdir(), "no-such-repo"))).toThrow(/Could not read gold.json/);
        fs.rmSync(dir, { recursive: true });
    });
});

describe("syncGold", () => {
    beforeEach(() => {
        vi.clearAllMocks();
        mockPrisma.knowledgeBase.findFirst.mockResolvedValue({ id: "kb1" });
        mockPrisma.knowledgeItem.findMany.mockResolvedValue([]);
        mockPrisma.knowledgeItem.create.mockResolvedValue({ id: "item" });
        mockPrisma.knowledgeItem.deleteMany.mockResolvedValue({ count: 0 });
        mockEmbed.mockResolvedValue([0.1]);
    });

    it("refuses a held-out example before touching anything", async () => {
        await expect(syncGold([example("a", "fewshot"), example("b", "heldout")], "team1", { dryRun: false })).rejects.toThrow(/held out/);
        expect(mockPrisma.knowledgeBase.findFirst).not.toHaveBeenCalled();
        expect(mockEmbed).not.toHaveBeenCalled();
    });

    it("embeds the situation and stores the example in the gold knowledge base", async () => {
        const result = await syncGold([example("a", "fewshot")], "team1", { dryRun: false });

        expect(mockEmbed).toHaveBeenCalledWith(situationText(example("a", "fewshot").input), "team1");
        expect(mockPrisma.knowledgeItem.create).toHaveBeenCalledWith(
            expect.objectContaining({
                data: expect.objectContaining({
                    knowledgeBaseId: "kb1",
                    metadata: expect.objectContaining({ source: "gold", exampleId: "a", node: "A", subject: "subject a", body: "body a", hash: expect.any(String) }),
                }),
            }),
        );
        expect(result).toMatchObject({ added: 1, failed: 0 });
    });

    it("a dry run writes and embeds nothing", async () => {
        const result = await syncGold([example("a", "fewshot")], "team1", { dryRun: true });
        expect(result).toMatchObject({ dryRun: true, added: 0 });
        expect(result.toAdd).toHaveLength(1);
        expect(mockEmbed).not.toHaveBeenCalled();
    });

    it("an edited example is added under a new hash and the old row removed", async () => {
        mockPrisma.knowledgeItem.findMany.mockResolvedValue([{ id: "old", metadata: { hash: "stale" } }]);
        mockPrisma.knowledgeItem.deleteMany.mockResolvedValue({ count: 1 });

        const result = await syncGold([example("a", "fewshot")], "team1", { dryRun: false });

        expect(result).toMatchObject({ added: 1, removed: 1 });
    });
});

describe("searchGold", () => {
    beforeEach(() => {
        vi.clearAllMocks();
        mockEmbed.mockResolvedValue([0.1]);
    });

    it("searches the gold knowledge base for the same node and returns the examples", async () => {
        mockPrisma.$queryRawUnsafe.mockResolvedValue([
            { id: "r1", content: "pain_context: x", metadata: { exampleId: "a", node: "A", subject: "s", body: "b", notes: "n" }, similarity: 0.9 },
            { id: "r2", content: "broken", metadata: { exampleId: "b" }, similarity: 0.8 },
        ]);

        const hits = await searchGold(example("q", "fewshot").input, "A", "team1", { limit: 2 });

        const args = mockPrisma.$queryRawUnsafe.mock.calls[0];
        expect(args.slice(2)).toEqual(["team1", GOLD_KB_NAME, 2, "node", "A"]);
        expect(hits).toEqual([{ exampleId: "a", node: "A", situation: "pain_context: x", subject: "s", body: "b", notes: "n", similarity: 0.9 }]);
    });

    it("returns nothing when the search fails", async () => {
        mockPrisma.$queryRawUnsafe.mockRejectedValue(new Error("db down"));
        expect(await searchGold(example("q", "fewshot").input, "A", "team1")).toEqual([]);
    });

    it("returns nothing for an input with no situation text, without calling anything", async () => {
        expect(await searchGold({ prospect_name: "P" }, "A", "team1")).toEqual([]);
        expect(mockEmbed).not.toHaveBeenCalled();
    });
});
