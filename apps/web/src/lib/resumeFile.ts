export const MAX_RESUME_BYTES = 2 * 1024 * 1024;

const RULES: Record<string, { type: string; matches: (bytes: Buffer) => boolean }> = {
    ".pdf": { type: "application/pdf", matches: (b) => b.subarray(0, 1024).includes("%PDF-") },
    ".docx": {
        type: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        matches: (b) => b.length > 4 && b[0] === 0x50 && b[1] === 0x4b && b[2] === 0x03 && b[3] === 0x04,
    },
    ".doc": {
        type: "application/msword",
        matches: (b) => b.length > 8 && [0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1].every((byte, i) => b[i] === byte),
    },
};

export type ResumeCheck = { ok: true; type: string } | { ok: false; error: string };

// A resume is a PDF or Word file: the name must end in one of those extensions and the first bytes must
// agree, so a renamed script or page is not stored as a resume.
export function checkResume(filename: string, bytes: Buffer): ResumeCheck {
    if (bytes.length === 0) return { ok: false, error: "The resume file is empty" };
    if (bytes.length > MAX_RESUME_BYTES) return { ok: false, error: "The resume must be 2MB or smaller" };

    const extension = Object.keys(RULES).find((ext) => filename.trim().toLowerCase().endsWith(ext));
    if (!extension) return { ok: false, error: "The resume must be a PDF, DOC or DOCX file" };

    const rule = RULES[extension]!;
    if (!rule.matches(bytes)) return { ok: false, error: "The file's contents do not match its type" };
    return { ok: true, type: rule.type };
}
