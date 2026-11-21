// JSON for a <script type="application/ld+json"> tag. Plain JSON.stringify leaves "<" alone, so a stored
// title containing "</script>" would close the tag and run what follows. The characters below are written
// as unicode escapes instead, which keeps the output valid JSON that parses back to the same data.
const BACKSLASH = String.fromCharCode(92);
const UNSAFE = new Set([0x3c, 0x3e, 0x26, 0x2028, 0x2029]); // < > & and the two line separators

export function jsonLdScript(data: unknown): string {
    let out = "";
    for (const ch of JSON.stringify(data)) {
        const code = ch.charCodeAt(0);
        out += UNSAFE.has(code) ? `${BACKSLASH}u${code.toString(16).padStart(4, "0")}` : ch;
    }
    return out;
}
