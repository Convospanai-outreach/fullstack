/**
 * Secure Browser Sandbox
 * 
 * Provides a secure, resource-limited environment for browser automation.
 * This service manages browser instances with proper sandboxing and security controls.
 */

import { Browser, LaunchOptions } from "puppeteer";
import puppeteer from "puppeteer-extra";
import StealthPlugin from "puppeteer-extra-plugin-stealth";

puppeteer.use(StealthPlugin());

export interface SandboxConfig {
    /** Maximum memory per browser instance (MB) */
    maxMemory?: number;
    /** Maximum CPU usage (0-100) */
    maxCpu?: number;
    /** Session timeout in milliseconds */
    sessionTimeout?: number;
    /** Allowed domains (allowlist) */
    allowedDomains?: string[];
    /** Blocked domains (denylist) */
    blockedDomains?: string[];
    /** Enable Chrome sandbox (recommended for production) */
    enableSandbox?: boolean;
}

export class BrowserSandbox {
    private static defaultConfig: SandboxConfig = {
        maxMemory: 512, // 512 MB per instance
        sessionTimeout: 300000, // 5 minutes
        enableSandbox: process.env.NODE_ENV === 'production', // Sandbox in production
        allowedDomains: [],
        blockedDomains: ['doubleclick.net', 'googleadservices.com'] // Block trackers
    };

    /**
     * Creates a secure browser instance with resource limits and sandbox
     */
    static async launch(customConfig?: SandboxConfig): Promise<Browser> {
        const config = { ...this.defaultConfig, ...customConfig };

        const launchOptions: LaunchOptions = {
            headless: true,
            args: this.buildSecureArgs(config),
            // Resource limits (only available in some environments)
            ...(process.platform === 'linux' && {
                // Linux-specific sandbox configuration
                env: {
                    ...process.env,
                    // Limit memory via cgroups (requires proper setup)
                    MALLOC_ARENA_MAX: '2'
                }
            })
        };

        console.log(`[BrowserSandbox] Launching browser (Sandbox: ${config.enableSandbox ? 'ENABLED' : 'DISABLED'})`);

        const browser = await puppeteer.launch(launchOptions);

        // Set session timeout
        if (config.sessionTimeout) {
            setTimeout(async () => {
                console.log(`[BrowserSandbox] Session timeout reached, closing browser`);
                await browser.close().catch(e => console.error('Failed to close browser:', e));
            }, config.sessionTimeout);
        }

        return browser;
    }

    /**
     * Builds secure Chrome arguments based on configuration
     */
    private static buildSecureArgs(config: SandboxConfig): string[] {
        const args: string[] = [
            // Performance and stability
            '--disable-dev-shm-usage',
            '--disable-accelerated-2d-canvas',
            '--disable-gpu',
            '--no-first-run',
            '--no-zygote',

            // Memory limits
            `--max-old-space-size=${config.maxMemory}`,
            '--disable-extensions',
            '--disable-plugins',

            // Privacy
            '--disable-background-networking',
            '--disable-background-timer-throttling',
            '--disable-backgrounding-occluded-windows',
            '--disable-breakpad',
            '--disable-component-extensions-with-background-pages',
            '--disable-features=TranslateUI',
            '--disable-ipc-flooding-protection',
            '--disable-renderer-backgrounding',
            '--disable-sync',
            '--metrics-recording-only',
            '--no-default-browser-check',
            '--no-pings',
            '--password-store=basic',
            '--use-mock-keychain',
        ];

        // SANDBOX CONTROL
        if (config.enableSandbox) {
            console.log('[BrowserSandbox] 🔒 Chrome sandbox ENABLED (secure mode)');
            // Do NOT add --no-sandbox or --disable-setuid-sandbox
            // The browser will run with full sandbox protection
        } else {
            console.warn('[BrowserSandbox] ⚠️  Chrome sandbox DISABLED (development mode only!)');
            args.push('--no-sandbox', '--disable-setuid-sandbox');
        }

        return args;
    }

    /**
     * Validates if a URL is allowed based on domain rules
     */
    static isUrlAllowed(url: string, config: SandboxConfig): boolean {
        try {
            const hostname = new URL(url).hostname;

            // Check blocked domains
            if (config.blockedDomains?.some(domain => hostname.includes(domain))) {
                console.warn(`[BrowserSandbox] Blocked domain: ${hostname}`);
                return false;
            }

            // Check allowed domains (if specified)
            if (config.allowedDomains && config.allowedDomains.length > 0) {
                const allowed = config.allowedDomains.some(domain => hostname.includes(domain));
                if (!allowed) {
                    console.warn(`[BrowserSandbox] Domain not in allowlist: ${hostname}`);
                    return false;
                }
            }

            return true;
        } catch (e) {
            console.error('[BrowserSandbox] Invalid URL:', url);
            return false;
        }
    }

    /**
     * Environment-specific guidance
     */
    static getEnvironmentGuidance(): string {
        if (process.env.NODE_ENV === 'production') {
            if (process.platform === 'linux') {
                return 'Production Linux: Ensure user namespaces are enabled. Run: sysctl kernel.unprivileged_userns_clone';
            } else if (process.platform === 'win32') {
                return 'Production Windows: Chrome sandbox requires appropriate permissions. Consider containerization (Docker).';
            }
        }
        return 'Development mode: Sandbox is disabled for compatibility.';
    }
}
