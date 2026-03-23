/**
 * Puppeteer Runner Shell
 * Migrated to backend.
 */
export async function runPuppeteer() {
    throw new Error("Puppeteer execution only allowed on backend.");
}

export interface LinkedInActionResult {
    ok: boolean;
    text?: string;
    data?: unknown;
    error?: string;
    action?: string;
}

export async function runLinkedInAction(_params: unknown): Promise<LinkedInActionResult> {
    return {
        ok: false,
        error: "LinkedIn automation runner is not configured in this runtime.",
    };
}
