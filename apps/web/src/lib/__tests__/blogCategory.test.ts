import { beforeEach, describe, expect, it, vi } from "vitest";

const files: Record<string, string> = {};
vi.mock("fs", () => {
    const api = {
        existsSync: (p: string) => p.endsWith("blog") || Object.keys(files).some((f) => p.endsWith(f)),
        readdirSync: () => Object.keys(files),
        readFileSync: (p: string) => files[Object.keys(files).find((f) => p.endsWith(f))!],
    };
    return { default: api, ...api };
});

import { getBlogPostBySlug, getBlogPosts } from "../blog";

describe("blog post category", () => {
    beforeEach(() => {
        for (const k of Object.keys(files)) delete files[k];
        files["with.md"] = '---\ntitle: With\ndescription: d\ndate: 2026-01-02\ncategory: Product News\n---\nBody';
        files["without.md"] = "---\ntitle: Without\ndescription: d\ndate: 2026-01-01\n---\nBody";
    });

    it("carries the category the editor chose", () => {
        expect(getBlogPostBySlug("with")?.category).toBe("Product News");
        expect(getBlogPosts().find((p) => p.slug === "with")?.category).toBe("Product News");
    });

    it("is empty for posts that have none, as all existing posts do", () => {
        expect(getBlogPostBySlug("without")?.category).toBe("");
    });
});
