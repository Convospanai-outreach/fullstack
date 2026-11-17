import fs from "fs";
import path from "path";
import { describe, expect, it } from "vitest";
import { parseFrontmatter } from "../frontmatter";

// The reader the site used before the CMS, kept here as the reference for files that already exist.
function previousReader(raw: string): Record<string, string> {
    const match = raw.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n([\s\S]*)$/);
    if (!match) return {};
    const data: Record<string, string> = {};
    for (const line of match[1]!.split("\n")) {
        const at = line.indexOf(":");
        if (at === -1) continue;
        const key = line.slice(0, at).trim();
        let value = line.slice(at + 1).trim();
        if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) value = value.slice(1, -1);
        data[key] = value;
    }
    return data;
}

describe("parseFrontmatter", () => {
    it("reads plain and quoted values, keeping a colon inside a value", () => {
        const { data, content } = parseFrontmatter('---\ntitle: "AI: the next step"\ndescription: \'Short one\'\ndate: 2026-06-28T15:27:41.538Z\nauthor: Jane\n---\n\nBody text\n');

        expect(data).toEqual({ title: "AI: the next step", description: "Short one", date: "2026-06-28T15:27:41.538Z", author: "Jane" });
        expect(content).toBe("\nBody text\n");
    });

    it("joins a long plain value that the CMS folded over several lines", () => {
        const { data } = parseFrontmatter("---\ntitle: Short\ndescription: Learn the technical guardrails and RAG strategies required to keep\n  your autonomous sales agents strictly factual.\n---\nBody");

        expect(data["description"]).toBe("Learn the technical guardrails and RAG strategies required to keep your autonomous sales agents strictly factual.");
        expect(data["title"]).toBe("Short");
    });

    it("joins and unescapes a folded double-quoted value", () => {
        const { data } = parseFrontmatter('---\ndescription: "A \\"quoted\\" word, a back\\\\slash and a\n  second line."\n---\nBody');

        expect(data["description"]).toBe('A "quoted" word, a back\\slash and a second line.');
    });

    it("unescapes a doubled apostrophe in a single-quoted value", () => {
        const { data } = parseFrontmatter("---\ntitle: 'It''s here'\n---\nBody");

        expect(data["title"]).toBe("It's here");
    });

    it("reads folded and literal block values", () => {
        const { data } = parseFrontmatter("---\nfolded: >-\n  one\n  two\nliteral: |\n  first\n  second\nnext: after\n---\nBody");

        expect(data["folded"]).toBe("one two");
        expect(data["literal"]).toBe("first\nsecond\n");
        expect(data["next"]).toBe("after");
    });

    it("keeps a --- line inside the body, and reads Windows line endings", () => {
        const { data, content } = parseFrontmatter("---\r\ntitle: T\r\n---\r\nAbove\r\n---\r\nBelow\r\n");

        expect(data).toEqual({ title: "T" });
        expect(content).toBe("Above\r\n---\r\nBelow\r\n");
    });

    it("returns the whole text as the body when there is no frontmatter", () => {
        expect(parseFrontmatter("Just text\n---\nmore")).toEqual({ data: {}, content: "Just text\n---\nmore" });
    });

    it("reads every existing blog post and the FAQ exactly as the previous reader did", () => {
        const contentDir = path.resolve(__dirname, "../../../content");
        const files = [
            ...fs.readdirSync(path.join(contentDir, "blog")).filter((f) => f.endsWith(".md")).map((f) => path.join(contentDir, "blog", f)),
            path.join(contentDir, "faq", "general.md"),
        ];
        expect(files.length).toBeGreaterThan(20);

        for (const file of files) {
            const raw = fs.readFileSync(file, "utf8");
            expect(parseFrontmatter(raw).data, path.basename(file)).toEqual(previousReader(raw));
        }
    });
});
