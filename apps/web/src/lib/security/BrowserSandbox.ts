
/**
 * Frontend Shell for BrowserSandbox.
 */
export class BrowserSandbox {
    static async launch(): Promise<any> {
        throw new Error("BrowserSandbox is only available on the backend service.");
    }
    static getEnvironmentGuidance(): string {
        return "Browser automation has been moved to the standalone backend service.";
    }
}
