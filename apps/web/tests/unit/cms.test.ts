import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import fs from "fs";
import path from "path";
import { getContent, listContentFiles } from "../../src/lib/cms";

vi.mock("fs");

describe("CMS Lib", () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it("should parse markdown file with frontmatter correctly", () => {
        const mockFileContent = `---
title: "Mock Title"
description: "Mock Description"
---
### Subtitle
Body content here.`;

        vi.spyOn(fs, "existsSync").mockReturnValue(true);
        vi.spyOn(fs, "readFileSync").mockReturnValue(mockFileContent);

        const result = getContent("test.md");

        expect(result.metadata).toEqual({
            title: "Mock Title",
            description: "Mock Description",
        });
        expect(result.content).toBe("### Subtitle\nBody content here.");
    });

    it("should parse markdown file without frontmatter correctly", () => {
        const mockFileContent = "Just markdown content here.";

        vi.spyOn(fs, "existsSync").mockReturnValue(true);
        vi.spyOn(fs, "readFileSync").mockReturnValue(mockFileContent);

        const result = getContent("test-no-frontmatter.md");

        expect(result.metadata).toEqual({});
        expect(result.content).toBe(mockFileContent);
    });

    it("should list markdown files recursively", () => {
        const mockEntries = [
            { name: "file1.md", isDirectory: () => false },
            { name: "sub", isDirectory: () => true },
        ] as fs.Dirent[];

        const mockSubEntries = [
            { name: "file2.md", isDirectory: () => false },
        ] as fs.Dirent[];

        vi.spyOn(fs, "existsSync").mockReturnValue(true);
        
        // Mock fs.readdirSync to return mock entries depending on path
        vi.spyOn(fs, "readdirSync").mockImplementation((dirPath: fs.PathLike): any => {
            if (String(dirPath).endsWith("sub")) {
                return mockSubEntries;
            }
            return mockEntries;
        });

        const files = listContentFiles();

        expect(files).toContain("file1.md");
        expect(files).toContain("sub/file2.md");
    });
});
