// The images editors upload in the CMS for the home page's six workflow steps. One place for the required
// sizes, so the CMS hint, the page and the CI test can never disagree. Ratio and minimum width are enforced
// (a 2x upload is fine); the exact size below is what to export.
export const STEP_IMAGE = {
    desktop: { width: 1600, height: 600 },
    mobile: { width: 900, height: 750 },
} as const;

// Decap writes /uploads/<file> (see media_folder / public_folder in decapCms.ts). Anything else is refused.
const UPLOAD_PATH = /^\/uploads\/[A-Za-z0-9][A-Za-z0-9._-]*\.(?:jpe?g|png|webp|avif)$/i;

export const cleanImagePath = (value: unknown): string => {
    const path = typeof value === "string" ? value.trim() : "";
    return UPLOAD_PATH.test(path) ? path : "";
};
