/**
 * Generic Adapter Shell
 * Migrated to backend.
 */
export class GenericAdapter {
    constructor() { console.warn("GenericAdapter is only available on the backend."); }
    async scrape() { throw new Error("Scraping execution only allowed on backend."); }
}
