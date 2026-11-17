// Checks for landing-page image uploads. The format comes from the file's first
// bytes, never from its name or the browser's Content-Type.

export const MAX_LANDING_IMAGE_BYTES = 2 * 1024 * 1024;

export type LandingImageFormat = { extension: "png" | "jpg" | "webp"; contentType: "image/png" | "image/jpeg" | "image/webp" };

export type LandingImageCheck =
    | { ok: true; format: LandingImageFormat }
    | { ok: false; status: 400 | 413 | 415; error: string };

const PNG_SIGNATURE = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];
const JPG_SIGNATURE = [0xff, 0xd8, 0xff];

function startsWith(bytes: Uint8Array, signature: number[]): boolean {
    return bytes.length >= signature.length && signature.every((byte, i) => bytes[i] === byte);
}

function ascii(bytes: Uint8Array, start: number, end: number): string {
    return String.fromCharCode(...bytes.subarray(start, end));
}

export function detectLandingImageFormat(bytes: Uint8Array): LandingImageFormat | null {
    if (startsWith(bytes, PNG_SIGNATURE)) return { extension: "png", contentType: "image/png" };
    if (startsWith(bytes, JPG_SIGNATURE)) return { extension: "jpg", contentType: "image/jpeg" };
    // WebP is a RIFF container whose form type (bytes 8-11) is "WEBP".
    if (bytes.length >= 12 && ascii(bytes, 0, 4) === "RIFF" && ascii(bytes, 8, 12) === "WEBP") {
        return { extension: "webp", contentType: "image/webp" };
    }
    return null;
}

export function checkLandingImageUpload(bytes: Uint8Array): LandingImageCheck {
    if (bytes.length === 0) return { ok: false, status: 400, error: "The image file is empty" };
    if (bytes.length > MAX_LANDING_IMAGE_BYTES) return { ok: false, status: 413, error: "The image must be 2MB or smaller" };
    const format = detectLandingImageFormat(bytes);
    if (!format) return { ok: false, status: 415, error: "The file must be a PNG, JPG or WebP image" };
    return { ok: true, format };
}
