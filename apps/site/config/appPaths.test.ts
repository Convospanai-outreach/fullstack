import fs from "fs";
import path from "path";
import { describe, expect, it } from "vitest";
import { appPaths } from "./appPaths.mjs";

const dashboardDir = path.join(__dirname, "..", "..", "web", "src", "app", "(dashboard)");

// Old emails, bookmarks and the app's own hardcoded links still use the public domain. Every page the
// app serves has to be handed over, otherwise the site answers 404 once the domain moves.
describe("appPaths", () => {
    const routes = fs.readdirSync(dashboardDir, { withFileTypes: true })
        .filter((entry) => entry.isDirectory() && !entry.name.startsWith("_") && !entry.name.startsWith("("))
        .map((entry) => entry.name);

    it("found the app's dashboard routes", () => {
        expect(routes).toEqual(expect.arrayContaining(["inbox", "leads", "campaigns", "settings"]));
    });

    it.each(routes)("forwards /%s to the app", (route) => {
        const covered = appPaths.some((source) => source === `/${route}` || source === `/${route}/:path*`);
        expect(covered).toBe(true);
    });

    it("keeps the sign-in and checkout paths", () => {
        expect(appPaths).toEqual(expect.arrayContaining(["/login/:path*", "/signup", "/checkout/:path*", "/cms/:path*"]));
    });
});
