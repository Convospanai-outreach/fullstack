import { describe, expect, it } from "vitest";
import fs from "fs";
import path from "path";
import { DASHBOARD_PREFIXES } from "../../src/components/layout/LayoutShell";

// Route groups like (dashboard) are directory-only, not part of the URL, so
// every top-level folder directly under app/(dashboard)/ must have a matching
// "/<folder>" entry in DASHBOARD_PREFIXES - otherwise LayoutShell renders it
// with the marketing Header/Footer instead of the dashboard sidebar chrome.
describe("LayoutShell DASHBOARD_PREFIXES stays in sync with app/(dashboard)/*", () => {
    it("has a prefix for every top-level (dashboard) route folder", () => {
        const dashboardDir = path.resolve(__dirname, "../../src/app/(dashboard)");
        const folders = fs
            .readdirSync(dashboardDir, { withFileTypes: true })
            .filter((entry) => entry.isDirectory())
            .map((entry) => `/${entry.name}`);

        const missing = folders.filter((folder) => !DASHBOARD_PREFIXES.includes(folder));
        expect(missing).toEqual([]);
    });
});
