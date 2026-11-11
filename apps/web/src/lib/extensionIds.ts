// Chrome extension IDs the /extension/connect page will hand a sync token to.
export const STORE_EXTENSION_ID = "jblkcbpgkhdnocdglpabbinaooobdjoo";
export const STORE_URL = `https://chromewebstore.google.com/detail/${STORE_EXTENSION_ID}`;

const EXTENSION_ID_PATTERN = /^[a-p]{32}$/;

// The Chrome Web Store build plus any unpacked/dev builds listed in EXTENSION_IDS (comma-separated).
export function knownExtensionIds(): string[] {
    const extra = (process.env["EXTENSION_IDS"] ?? "")
        .split(",")
        .map((id) => id.trim())
        .filter((id) => EXTENSION_ID_PATTERN.test(id));
    return Array.from(new Set([STORE_EXTENSION_ID, ...extra]));
}

export function isKnownExtensionId(id: string | null | undefined): id is string {
    return typeof id === "string" && knownExtensionIds().includes(id);
}
