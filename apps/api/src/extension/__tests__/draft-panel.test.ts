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

// A LinkedIn chat with one person: a heading naming them and the box to type in.
function openMessageBox(text = "", withName = "Jane Doe") {
    const chat = document.createElement("div");
    chat.className = "msg-overlay-conversation-bubble";
    const heading = document.createElement("header");
    heading.textContent = withName;
    const box = document.createElement("div");
    box.className = "msg-form__contenteditable";
    box.setAttribute("contenteditable", "true");
    box.textContent = text;
    chat.append(heading, box);
    document.body.appendChild(chat);
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

    it("never puts the draft in a chat that is open with someone else", async () => {
        const other = openMessageBox("", "Omar Ali");

        expect(page.showDraft("Jane Doe", "Hi Jane")).toEqual({ ok: true, inserted: false });
        expect(other.textContent).toBe("");
        expect(panel()).not.toBeNull();

        const janes = openMessageBox("", "  jane   doe ");
        await pageSettles();

        expect(janes.textContent).toBe("Hi Jane");
        expect(other.textContent).toBe("");
        expect(panel()).toBeNull();
    });

    it("leaves the draft in the panel when it cannot tell whose chat is open", async () => {
        const unnamed = document.createElement("div");
        unnamed.className = "msg-form__contenteditable";
        unnamed.setAttribute("contenteditable", "true");
        document.body.appendChild(unnamed);
        const forNoName = openMessageBox();

        expect(page.showDraft("Jane Doe", "Hi Jane")).toEqual({ ok: true, inserted: true });
        expect(unnamed.textContent).toBe("");
        forNoName.textContent = "";

        expect(page.showDraft("", "Hi Jane")).toEqual({ ok: true, inserted: false });
        await pageSettles();
        expect(forNoName.textContent).toBe("");
        expect(unnamed.textContent).toBe("");
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
