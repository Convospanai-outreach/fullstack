import { McpClient } from "../McpClient";
import { BrowserEngine } from "@/lib/browser-engine";
import { Page } from "puppeteer";

export class ComputerUseServer {
    private client: McpClient;
    private browserEngine: BrowserEngine;

    constructor() {
        this.client = new McpClient({
            id: "computer-use",
            name: "Computer Use (Internal)",
            transport: "stdio" // Virtual/Mock
        });
        this.browserEngine = BrowserEngine.getInstance();
    }

    async initialize() {
        // Register Tools
        this.registerNavigate();
        this.registerClick();
        this.registerType();
        this.registerScreenshot();
        this.registerGetContent();

        await this.client.connect();
        return this.client;
    }

    private registerNavigate() {
        this.client.registerTool({
            name: "computer_navigate",
            description: "Navigates the browser to a specific URL.",
            inputSchema: {
                type: "object",
                properties: {
                    url: { type: "string", description: "The URL to navigate to." }
                },
                required: ["url"]
            }
        });
        // Mock implementation hook - in a real MCP server, this would be an event handler
        this.overrideToolCall("computer_navigate", async (args) => {
            const page = await this.getPage();
            await page.goto(args.url, { waitUntil: 'networkidle2' });
            return { content: [{ type: "text", text: `Navigated to ${args.url}` }] };
        });
    }

    private registerClick() {
        this.client.registerTool({
            name: "computer_click",
            description: "Clicks on an element specified by the CSS selector.",
            inputSchema: {
                type: "object",
                properties: {
                    selector: { type: "string", description: "CSS selector of the element." }
                },
                required: ["selector"]
            }
        });
        this.overrideToolCall("computer_click", async (args) => {
            const page = await this.getPage();
            await page.click(args.selector);
            return { content: [{ type: "text", text: `Clicked ${args.selector}` }] };
        });
    }

    private registerType() {
        this.client.registerTool({
            name: "computer_type",
            description: "Types text into an element specified by the CSS selector.",
            inputSchema: {
                type: "object",
                properties: {
                    selector: { type: "string", description: "CSS selector of the element." },
                    text: { type: "string", description: "Text to type." }
                },
                required: ["selector", "text"]
            }
        });
        this.overrideToolCall("computer_type", async (args) => {
            const page = await this.getPage();
            await page.type(args.selector, args.text);
            return { content: [{ type: "text", text: `Typed into ${args.selector}` }] };
        });
    }

    private registerScreenshot() {
        this.client.registerTool({
            name: "computer_screenshot",
            description: "Takes a screenshot of the current page state.",
            inputSchema: {
                type: "object",
                properties: {},
            }
        });
        this.overrideToolCall("computer_screenshot", async () => {
            const page = await this.getPage();
            const screenshot = await page.screenshot({ encoding: "base64" });
            return {
                content: [{
                    type: "image",
                    mimeType: "image/png",
                    blob: screenshot as string
                }]
            };
        });
    }

    private registerGetContent() {
        this.client.registerTool({
            name: "computer_get_content",
            description: "Gets the text content of the page.",
            inputSchema: { type: "object", properties: {} }
        });
        this.overrideToolCall("computer_get_content", async () => {
            const page = await this.getPage();
            const content = await page.content(); // HTML
            // Ideally convert to markdown
            return { content: [{ type: "text", text: content.substring(0, 5000) + "..." }] };
        });
    }

    private async getPage(): Promise<Page> {
        // Reuse tabs if possible, for now just get new/current
        const pages = await (await this.browserEngine.getBrowser()).pages();
        if (pages.length > 0 && pages[0]) return pages[0];
        return await this.browserEngine.getPage();
    }

    // Helper to hijack the mock client's callTool for internal execution
    private overrideToolCall(name: string, impl: (args: any) => Promise<any>) {
        const originalCall = this.client.callTool.bind(this.client);
        this.client.callTool = async (n, args) => {
            if (n === name) {
                console.log(`[ComputerUse] Executing ${name}...`);
                try {
                    return await impl(args);
                } catch (e: any) {
                    return { content: [{ type: "text", text: `Error: ${e.message}` }], isError: true };
                }
            }
            return originalCall(n, args);
        };
    }
}
