import { afterEach, describe, expect, it, vi } from "vitest";
import { buildDecapConfig, canonicalOrigin, DECAP_SCRIPT } from "../decapCms";

describe("buildDecapConfig", () => {
    const config = buildDecapConfig("https://www.example.com");

    it("logs in with GitHub through this site's own endpoint, and publishes by pull request", () => {
        expect(config).toContain("name: github");
        expect(config).toContain("repo: Convospanai-outreach/fullstack");
        expect(config).toContain("branch: main");
        expect(config).toContain("base_url: https://www.example.com");
        expect(config).toContain("auth_endpoint: api/cms/auth");
        expect(config).toContain("publish_mode: editorial_workflow");
    });

    it("stores uploads in the web app's public folder", () => {
        expect(config).toContain("media_folder: apps/web/public/uploads");
        expect(config).toContain("public_folder: /uploads");
    });

    it("manages the blog posts and the FAQ where the site already reads them", () => {
        expect(config).toContain("folder: apps/web/content/blog");
        expect(config).toContain("file: apps/web/content/faq/general.md");
        for (const field of ["title", "description", "date", "body"]) expect(config).toContain(`name: ${field}`);
    });

    it("contains no secret", () => {
        expect(config).not.toMatch(/client_secret|CLIENT_SECRET|token/i);
    });
});

describe("canonicalOrigin", () => {
    afterEach(() => vi.unstubAllEnvs());

    it("is the site's configured address, without a trailing slash or path", () => {
        vi.stubEnv("NEXTAUTH_URL", "https://www.example.com/");
        expect(canonicalOrigin("http://localhost:10000/cms")).toBe("https://www.example.com");
    });

    it("falls back to the request's own origin when no address is configured", () => {
        vi.stubEnv("NEXTAUTH_URL", "");
        vi.stubEnv("APP_URL", "");
        expect(canonicalOrigin("http://localhost:3000/cms")).toBe("http://localhost:3000");
    });
});

describe("DECAP_SCRIPT", () => {
    it("is pinned to an exact version and an integrity hash", () => {
        expect(DECAP_SCRIPT.src).toMatch(/^https:\/\/unpkg\.com\/decap-cms@\d+\.\d+\.\d+\/dist\/decap-cms\.js$/);
        expect(DECAP_SCRIPT.integrity).toMatch(/^sha384-[A-Za-z0-9+/]{64}$/);
    });
});
