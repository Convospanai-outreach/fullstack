import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

// The extension runs with chrome.* permissions, so page- or API-sourced text must reach the DOM
// through textContent / DOM methods. Clearing a node with `innerHTML = ""` is the only allowed use.
const ROOT = join(__dirname, "..");

function scripts(dir: string): string[] {
    return readdirSync(dir).flatMap((name) => {
        if (name === "__tests__" || name === "node_modules") return [];
        const path = join(dir, name);
        if (statSync(path).isDirectory()) return scripts(path);
        return path.endsWith(".js") ? [path] : [];
    });
}

describe("extension scripts", () => {
    it("never assign non-empty HTML to innerHTML, outerHTML or insertAdjacentHTML", () => {
        const offenders: string[] = [];
        for (const file of scripts(ROOT)) {
            readFileSync(file, "utf8").split("\n").forEach((line, i) => {
                const assignsHtml = /\.(innerHTML|outerHTML)\s*[+]?=(?!=)/.test(line) && !/\.(innerHTML|outerHTML)\s*=\s*(""|'');?\s*$/.test(line);
                if (assignsHtml || /insertAdjacentHTML\s*\(/.test(line)) offenders.push(`${file.slice(ROOT.length + 1)}:${i + 1}`);
            });
        }
        expect(offenders).toEqual([]);
    });
});
