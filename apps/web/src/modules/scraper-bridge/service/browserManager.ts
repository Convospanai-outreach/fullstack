/**
 * Browser Manager Shell
 * Migrated to backend.
 */
export const browserManager = {
    async getPage() { throw new Error("Browser execution only allowed on backend."); },
    async newPage(_id: string) { throw new Error("Browser execution only allowed on backend."); },
    async closePage(_id: string) { throw new Error("Browser execution only allowed on backend."); },
    async close() { throw new Error("Browser execution only allowed on backend."); }
};
