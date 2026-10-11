// @vitest-environment jsdom
import fs from "node:fs";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// Runs the shipped content.js in a page, with a stand-in for the chrome messaging it registers.
const source = fs.readFileSync(path.resolve(__dirname, "..", "content.js"), "utf8");

function loadContentScript() {
    const chrome = { runtime: { sendMessage: () => undefined, onMessage: { addListener: () => undefined }, lastError: undefined } };
    return new Function("chrome", `${source}\nreturn { showDraft, closeDraftPanel };`)(chrome) as {
        showDraft: (name: string, text: string) => { ok: boolean; inserted?: boolean; error?: string };
        closeDraftPanel: () => void;
    };
}

function openMessageBox(text = "") {
    const box = document.createElement("div");
    box.className = "msg-form__contenteditable";
    box.setAttribute("contenteditable", "true");
    box.textContent = text;
    document.body.appendChild(box);
    return box;
}

const panel = () => document.getElementById("cmf-draft-panel");
const pageSettles = () => new Promise((resolve) => setTimeout(resolve, 0));

describe("content script: a draft from the due steps list", () => {
    let page: ReturnType<typeof loadContentScript>;

    beforeEach(() => {
        document.body.replaceChildren();
        page = loadContentScript();
    });

    // Each test loads its own copy of the script; a copy left watching the page would fill the next test's box.
    afterEach(() => page.closeDraftPanel());

    it("goes straight into the message box when it is open and empty", () => {
        const box = openMessageBox();

        expect(page.showDraft("Jane Doe", "Hi Jane")).toEqual({ ok: true, inserted: true });
        expect(box.textContent).toBe("Hi Jane");
        expect(panel()).toBeNull();
    });

    it("waits on the page when no message box is open, and fills it once the person opens one", async () => {
        expect(page.showDraft("Jane Doe", "Hi Jane")).toEqual({ ok: true, inserted: false });
        expect(panel()?.textContent).toContain("CraftMyFunnel draft for Jane Doe");
        expect(panel()?.textContent).toContain("Hi Jane");

        const box = openMessageBox();
        await pageSettles();

        expect(box.textContent).toBe("Hi Jane");
        expect(panel()).toBeNull();
    });

    it("never replaces text the person has already typed", async () => {
        const box = openMessageBox("my own words");

        expect(page.showDraft("Jane Doe", "Hi Jane")).toEqual({ ok: true, inserted: false });
        document.body.appendChild(document.createElement("span"));
        await pageSettles();

        expect(box.textContent).toBe("my own words");
        expect(panel()).not.toBeNull();
    });

    it("stops filling message boxes once the panel is closed", async () => {
        page.showDraft("Jane Doe", "Hi Jane");
        (Array.from(panel()!.querySelectorAll("button")).find((button) => button.textContent === "Close") as HTMLButtonElement).click();

        const box = openMessageBox();
        await pageSettles();

        expect(panel()).toBeNull();
        expect(box.textContent).toBe("");
    });

    it("copies the draft from the panel", async () => {
        const writeText = vi.fn().mockResolvedValue(undefined);
        Object.defineProperty(navigator, "clipboard", { value: { writeText }, configurable: true });

        page.showDraft("", "Hi Jane");
        (Array.from(panel()!.querySelectorAll("button")).find((button) => button.textContent === "Copy") as HTMLButtonElement).click();

        expect(writeText).toHaveBeenCalledWith("Hi Jane");
    });

    it("refuses a step with no message", () => {
        expect(page.showDraft("Jane Doe", "")).toEqual({ ok: false, error: "This step has no message." });
        expect(panel()).toBeNull();
    });
});
