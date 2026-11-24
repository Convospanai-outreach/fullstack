// Reads the frontmatter of a markdown file written by hand or by the CMS.
//
// Only the part of YAML that content files use: top-level `key: value` pairs whose values are text.
// A value may be plain, single- or double-quoted, spread over several indented lines (the CMS folds
// anything longer than 80 characters), or a block scalar (`>`, `>-`, `|`, `|-`). Everything is
// returned as a string, as the site's loaders already treat it.

export interface ParsedFrontmatter {
    data: Record<string, string>;
    content: string;
}

const FRONTMATTER = /^---\r?\n([\s\S]*?)\r?\n---(?:\r?\n([\s\S]*))?$/;

function unquote(value: string): string {
    if (value.length >= 2 && value.startsWith('"') && value.endsWith('"')) {
        return value.slice(1, -1).replace(/\\(["\\nt])/g, (_match, ch: string) => (ch === "n" ? "\n" : ch === "t" ? "\t" : ch));
    }
    if (value.length >= 2 && value.startsWith("'") && value.endsWith("'")) {
        return value.slice(1, -1).replace(/''/g, "'");
    }
    return value;
}

function blockScalar(indicator: string, lines: string[]): string {
    const text = lines.map((line) => line.replace(/^\s+/, "")).join(indicator.startsWith("|") ? "\n" : " ");
    // `-` strips the final newline; without it a literal block keeps one.
    return indicator.includes("-") || !indicator.startsWith("|") ? text : `${text}\n`;
}

export function parseFrontmatter(raw: string): ParsedFrontmatter {
    const match = raw.match(FRONTMATTER);
    if (!match) return { data: {}, content: raw };

    const data: Record<string, string> = {};
    let key: string | null = null;
    let parts: string[] = [];

    const finish = () => {
        if (key === null) return;
        const first = parts[0] ?? "";
        const rest = parts.slice(1);
        data[key] = /^[>|][+-]?$/.test(first) ? blockScalar(first, rest) : unquote([first, ...rest.map((line) => line.trim())].join(" ").trim());
        key = null;
        parts = [];
    };

    for (const line of match[1]!.split(/\r?\n/)) {
        const continuation = key !== null && /^\s+\S/.test(line);
        if (continuation) {
            parts.push(line);
            continue;
        }
        const at = line.indexOf(":");
        if (at === -1) continue;
        finish();
        key = line.slice(0, at).trim();
        parts = [line.slice(at + 1).trim()];
    }
    finish();

    return { data, content: match[2] ?? "" };
}
