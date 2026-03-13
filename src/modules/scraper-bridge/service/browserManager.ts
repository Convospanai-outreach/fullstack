/**
 * Browser Manager Shell
 * Migrated to backend.
 */
export const browserManager = {
    async getPage() { throw new Error("Browser execution only allowed on backend."); },
    async close() { throw new Error("Browser execution only allowed on backend."); }
};
