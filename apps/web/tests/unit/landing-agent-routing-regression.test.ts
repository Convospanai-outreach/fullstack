import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

function readWorkspaceFile(...parts: string[]) {
    const full = path.resolve(process.cwd(), ...parts);
    return fs.readFileSync(full, "utf8");
}

describe("landing-agent routing regressions", () => {
    it("keeps existing campaign wizard entrypoint intact", () => {
        const content = readWorkspaceFile("src", "app", "(dashboard)", "campaigns", "new", "page.tsx");
        expect(content).toContain('import StrategyWizard from "@/components/campaigns/StrategyWizard"');
        expect(content).toContain("<StrategyWizard");
    });

    it("whitelists /p public pages and landing-agent public API prefix in proxy", () => {
        const proxyContent = readWorkspaceFile("src", "proxy.ts");
        expect(proxyContent).toContain("/api/proxy/landing-agent/public");
        expect(proxyContent).toContain('path.startsWith("/p/")');
    });
});
