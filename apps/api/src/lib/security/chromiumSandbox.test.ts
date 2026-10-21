import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const { mockLaunch } = vi.hoisted(() => ({ mockLaunch: vi.fn() }));

vi.mock("puppeteer-extra", () => ({ default: { use: vi.fn(), launch: mockLaunch } }));
vi.mock("puppeteer-extra-plugin-stealth", () => ({ default: vi.fn() }));
vi.mock("puppeteer", () => ({ default: { launch: mockLaunch } }));
vi.mock("@/lib/logger", () => ({ logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() } }));

import { chromiumSandboxArgs } from "./chromiumSandbox";
import { BrowserSandbox } from "../../../services/browser/BrowserSandbox";
import { BrowserManager } from "../../modules/scraper-bridge/service/browserManager";

const NO_SANDBOX = ["--no-sandbox", "--disable-setuid-sandbox"];

describe("chromiumSandboxArgs", () => {
    const original = process.env["ENABLE_BROWSER_SANDBOX"];
    afterEach(() => {
        if (original === undefined) delete process.env["ENABLE_BROWSER_SANDBOX"];
        else process.env["ENABLE_BROWSER_SANDBOX"] = original;
    });

    it("keeps the sandbox off by default, so existing containers keep launching", () => {
        delete process.env["ENABLE_BROWSER_SANDBOX"];
        expect(chromiumSandboxArgs()).toEqual(NO_SANDBOX);
    });

    it("keeps it off for any value other than 'true'", () => {
        process.env["ENABLE_BROWSER_SANDBOX"] = "false";
        expect(chromiumSandboxArgs()).toEqual(NO_SANDBOX);
        process.env["ENABLE_BROWSER_SANDBOX"] = "1";
        expect(chromiumSandboxArgs()).toEqual(NO_SANDBOX);
    });

    it("turns the sandbox on (no flags) when ENABLE_BROWSER_SANDBOX=true", () => {
        process.env["ENABLE_BROWSER_SANDBOX"] = "true";
        expect(chromiumSandboxArgs()).toEqual([]);
    });
});

describe.each([
    ["BrowserSandbox", async () => { await BrowserSandbox.launch({}); }],
    ["BrowserManager", async () => { await new BrowserManager().getBrowser(); }],
])("%s launch arguments follow ENABLE_BROWSER_SANDBOX", (_name, launch) => {
    const original = process.env["ENABLE_BROWSER_SANDBOX"];
    beforeEach(() => {
        mockLaunch.mockReset();
        mockLaunch.mockResolvedValue({ on: vi.fn() });
    });
    afterEach(() => {
        if (original === undefined) delete process.env["ENABLE_BROWSER_SANDBOX"];
        else process.env["ENABLE_BROWSER_SANDBOX"] = original;
    });

    it("passes --no-sandbox only while the flag is off", async () => {
        delete process.env["ENABLE_BROWSER_SANDBOX"];
        await launch();
        expect(mockLaunch.mock.calls[0][0].args).toEqual(expect.arrayContaining(NO_SANDBOX));
    });

    it("drops the sandbox-disabling flags when the flag is on", async () => {
        process.env["ENABLE_BROWSER_SANDBOX"] = "true";
        await launch();
        const args: string[] = mockLaunch.mock.calls[0][0].args;
        expect(args).not.toContain("--no-sandbox");
        expect(args).not.toContain("--disable-setuid-sandbox");
    });
});
