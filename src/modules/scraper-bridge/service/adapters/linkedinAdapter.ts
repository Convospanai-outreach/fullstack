/**
 * LinkedIn Adapter Shell
 * Migrated to backend.
 */
export class LinkedInAdapter {
    constructor() { console.warn("LinkedInAdapter is only available on the backend."); }
    async scrape() { throw new Error("Scraping execution only allowed on backend."); }
}
