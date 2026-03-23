/**
 * Computer Use Server Shell
 * Migrated to backend.
 */
export class ComputerUseServer {
    constructor() { console.warn("ComputerUseServer is only available on the backend."); }
    
    async initialize(): Promise<any> {
        throw new Error("ComputerUseServer initialization is only available on the backend.");
    }

    async start(): Promise<void> { 
        throw new Error("MCP server start only allowed on backend."); 
    }
}
