
import { mcpManager } from "../src/lib/mcp/McpManager";

async function main() {
    console.log("1. Initializing MCP Manager...");
    await mcpManager.initialize();

    console.log("2. Listing All Tools...");
    const tools = await mcpManager.getAllTools();
    console.log(`Found ${tools.length} tools.`);
    tools.forEach(t => console.log(` - ${t.name}: ${t.description}`));

    const requiredTools = ["computer_navigate", "computer_click", "computer_type", "computer_screenshot"];
    const missing = requiredTools.filter(req => !tools.some(t => t.name === req));

    if (missing.length > 0) {
        console.error("FAILED: Missing required tools:", missing);
        process.exit(1);
    }

    console.log("3. Testing Local Client Retrieval...");
    const client = mcpManager.getClient("computer-use");
    if (!client) {
        console.error("FAILED: Could not retrieve 'computer-use' client.");
        process.exit(1);
    }

    console.log("PASSED: MCP Infrastructure is ready.");
    process.exit(0);
}

main().catch(err => {
    console.error("Unhandled Error:", err);
    process.exit(1);
});
