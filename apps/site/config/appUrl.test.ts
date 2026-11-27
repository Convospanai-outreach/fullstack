import { spawnSync } from "node:child_process";
import path from "node:path";
import { describe, expect, it } from "vitest";

const cwd = path.resolve(__dirname, "..");
const load = (value: string | undefined) => {
    const env = { ...process.env, NODE_ENV: "production" };
    if (value === undefined) delete env.NEXT_PUBLIC_APP_URL;
    else env.NEXT_PUBLIC_APP_URL = value;
    return spawnSync(process.execPath, ["--input-type=module", "-e", 'import("./config/appUrl.mjs").then(({ APP_URL }) => console.log(APP_URL))'], {
        cwd,
        env,
        encoding: "utf8",
    });
};

describe("production app URL", () => {
    it("rejects a missing app host", () => {
        const result = load(undefined);
        expect(result.status).not.toBe(0);
        expect(result.stderr).toContain("NEXT_PUBLIC_APP_URL is required");
    });

    it("uses the configured host without a trailing slash", () => {
        const result = load("https://app.example.test/");
        expect(result.status).toBe(0);
        expect(result.stdout.trim()).toBe("https://app.example.test");
    });
});
