import { createHash } from "node:crypto";

export interface PlaybookChunk {
    file: string;
    heading: string;
    // Heading path plus body: what is embedded and what retrieval returns.
    text: string;
    // Identity of this exact text in this exact place; sync uses it to skip, add or replace.
    hash: string;
}

const MIN_BODY_CHARS = 20;

function hashChunk(file: string, heading: string, text: string) {
    return createHash("sha256").update(`${file}\n${heading}\n${text}`).digest("hex").slice(0, 16);
}

// Packs paragraphs into pieces of at most maxChars; one paragraph longer than that is cut hard.
function splitBody(body: string, maxChars: number): string[] {
    const pieces: string[] = [];
    let current = "";
    for (const paragraph of body.split(/\n\s*\n/).map((p) => p.trim()).filter(Boolean)) {
        if (current && current.length + paragraph.length + 2 > maxChars) {
            pieces.push(current);
            current = "";
        }
        if (paragraph.length > maxChars) {
            for (let i = 0; i < paragraph.length; i += maxChars) pieces.push(paragraph.slice(i, i + maxChars));
            continue;
        }
        current = current ? `${current}\n\n${paragraph}` : paragraph;
    }
    if (current) pieces.push(current);
    return pieces;
}

// Splits a markdown file by heading, so each chunk carries the path of headings above it
// ("Cold email > Subject lines") and a retrieved chunk makes sense on its own.
export function chunkMarkdown(file: string, markdown: string, maxChars = 1200): PlaybookChunk[] {
    const chunks: PlaybookChunk[] = [];
    const path: string[] = [];
    let body: string[] = [];
    let inFence = false;

    const flush = () => {
        const text = body.join("\n").trim();
        body = [];
        if (text.length < MIN_BODY_CHARS) return;
        const heading = path.filter(Boolean).join(" > ") || file;
        for (const piece of splitBody(text, maxChars)) {
            const full = `${heading}\n${piece}`;
            chunks.push({ file, heading, text: full, hash: hashChunk(file, heading, full) });
        }
    };

    for (const line of markdown.replace(/\r\n/g, "\n").split("\n")) {
        if (/^\s*```/.test(line)) inFence = !inFence;
        const match = !inFence ? /^(#{1,6})\s+(.+?)\s*#*\s*$/.exec(line) : null;
        if (match) {
            flush();
            path.length = match[1].length - 1;
            path[match[1].length - 1] = match[2];
            continue;
        }
        body.push(line);
    }
    flush();
    return chunks;
}
