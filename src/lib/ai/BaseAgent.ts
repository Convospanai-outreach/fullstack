/**
 * Frontend shell for BaseAgent.
 * This file is a placeholder to prevent build errors.
 * Logic has been migrated to the backend (convospan-api).
 */
export abstract class BaseAgent {
    constructor() {
        console.warn("BaseAgent is only available on the backend.");
    }

    protected async generateJSON<T>(prompt: string, schemaDescription: string, retries = 2): Promise<T> {
        throw new Error("AI Agent execution is only available on the backend.");
    }
}
