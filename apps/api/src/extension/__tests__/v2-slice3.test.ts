import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

// The shipped extension is the hand-written .js in this folder (see
// scripts/package-extension.ps1). These guard the roadmap 2.4 slice-3 wiring;
// the runtime itself needs the owner's load-test (a Chrome extension can't be
// E2E-tested here).
const extDir = path.resolve(__dirname, "..");
const read = (file: string) => fs.readFileSync(path.join(extDir, file), "utf8");

describe("roadmap 2.4 slice 3 — v2 extension manifest", () => {
    const manifest = JSON.parse(read("manifest.v2.json"));

    it("is a valid MV3 manifest that declares the v2 permissions", () => {
        expect(manifest.manifest_version).toBe(3);
        expect(manifest.version).toBe("2.0.0");
        for (const perm of ["alarms", "notifications", "tabs", "storage", "activeTab"]) {
            expect(manifest.permissions).toContain(perm);
        }
    });

    it("wires the shared background/content scripts and the options page", () => {
        expect(manifest.background.service_worker).toBe("background.js");
        expect(manifest.content_scripts[0].js).toContain("content.js");
        expect(manifest.options_page).toBe("options.html");
    });

    it("leaves the published V1 manifest untouched (still approval-safe)", () => {
        const v1 = JSON.parse(read("manifest.json"));
        expect(v1.version).toBe("1.0.0");
        expect(v1.permissions).toEqual(["activeTab", "storage"]);
        expect(v1.permissions).not.toContain("alarms");
    });
});

describe("roadmap 2.4 slice 3 — background.js merge", () => {
    const bg = read("background.js");

    it("gates the whole v2 poller on the alarms capability so it is inert under V1", () => {
        expect(bg).toContain('typeof chrome.alarms !== "undefined"');
        expect(bg).toContain("if (V2_ENABLED) {");
    });

    it("preserves the V1 popup message handlers", () => {
        for (const msg of ["CMF_STORE_VISIBLE_PROFILE", "CMF_SAVE_PREPARED_LEAD", "CMF_GET_V1_STATE"]) {
            expect(bg).toContain(msg);
        }
    });

    it("handles the flat settings contract the options page sends", () => {
        for (const msg of ["UPDATE_SETTINGS", "GET_STATE", "TOGGLE_PAUSE"]) {
            expect(bg).toContain(`msg?.type === "${msg}"`);
        }
    });

    it("dispatches EXECUTE_TASK for the profile-tab task types and polls the API host", () => {
        expect(bg).toContain('type: "EXECUTE_TASK"');
        expect(bg).toContain("/extension/tasks/pending");
    });

    it("persists pending tasks (survives MV3 worker restart) and re-dispatches on content-ready", () => {
        // In-memory map would strand tasks as server-side 'processing' with no watchdog.
        expect(bg).toContain("cmfPendingTasks");
        expect(bg).toContain('msg?.type === "CMF_CONTENT_READY"');
        expect(bg).toContain("function dispatchExecuteTask");
    });
});

describe("roadmap 2.4 slice 3 — content.js executor stays assistive", () => {
    const content = read("content.js");

    it("adds the EXECUTE_TASK executor and the draft-insertion helper", () => {
        expect(content).toContain('msg?.type === "EXECUTE_TASK"');
        expect(content).toContain("function insertDraftIntoComposer");
    });

    it("never auto-submits (no click, and no synthetic Enter/keydown to send)", () => {
        expect(content).not.toContain(".click(");
        // A synthetic Enter keydown would submit LinkedIn's composer — the ToS
        // claim is that the human always sends, so this vector must be absent too.
        expect(content).not.toContain("KeyboardEvent");
    });
});

describe("roadmap 2.4 slice 3 — options helper exists", () => {
    it("utils.js provides cmfNormalizeApiBase used by options.js", () => {
        expect(read("utils.js")).toContain("function cmfNormalizeApiBase");
        expect(read("options.js")).toContain("cmfNormalizeApiBase(");
    });
});
