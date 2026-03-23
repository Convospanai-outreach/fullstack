/**
 * Humanizer Shell
 * Migrated to backend.
 */
export class Humanizer {
    constructor() { console.warn("Humanizer is only available on the backend."); }
    async simulate() { throw new Error("Humanizer simulation only allowed on backend."); }
}
