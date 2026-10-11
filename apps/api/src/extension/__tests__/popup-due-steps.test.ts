// @vitest-environment jsdom
import fs from "node:fs";
import path from "node:path";
import { beforeEach, describe, expect, it, vi } from "vitest";

// Runs the shipped popup (popup.html + utils.js + popup.js) with a stand-in for the background
// worker, to check the Due tab end to end on the popup side.
const extDir = path.resolve(__dirname, "..");
const read = (file: string) => fs.readFileSync(path.join(extDir, file), "utf8");

const jane = { runId: "run-jane", name: "Jane Doe", company: "Acme", profileUrl: "https://www.linkedin.com/in/jane-doe/", action: "Send chat message", message: "Hi Jane", sequence: "Outbound" };
const omar = { runId: "run-omar", name: "Omar Ali", company: "", profileUrl: "https://www.linkedin.com/in/omar-ali/", action: "Visit profile", message: "", sequence: "Outbound" };

let background: Record<string, any>;
let chrome: any;

async function openPopup(tabUrl: string) {
    // The popup's markup without its script tags; the scripts are run below with the stand-in.
    const markup = new DOMParser().parseFromString(read("popup.html"), "text/html");
    markup.querySelectorAll("script").forEach((script) => script.remove());
    document.body.replaceChildren(...Array.from(markup.body.childNodes).map((node) => document.importNode(node, true)));
    chrome = {
        runtime: {
            lastError: undefined,
            sendMessage: vi.fn(async (msg: any) => (typeof background[msg.type] === "function" ? background[msg.type](msg) : background[msg.type])),
        },
        tabs: {
            query: vi.fn(async () => [{ id: 7, url: tabUrl }]),
            create: vi.fn(),
            sendMessage: vi.fn((_tabId: number, _msg: any, respond: (value: any) => void) => respond({ ok: true, inserted: false })),
        },
    };
    new Function("chrome", `${read("utils.js")}\n${read("popup.js")}`)(chrome);
    await settle();
}

const settle = async () => {
    for (let i = 0; i < 10; i++) await new Promise((resolve) => setTimeout(resolve, 0));
};
const items = () => Array.from(document.querySelectorAll("#dueSteps li"));
const button = (item: Element, label: string) => Array.from(item.querySelectorAll("button")).find((el) => el.textContent === label) as HTMLButtonElement | undefined;
const activeTab = () => document.querySelector(".tab.active")?.getAttribute("data-tab");

describe("popup: Due tab", () => {
    beforeEach(() => {
        background = {
            CMF_GET_V1_STATE: { ok: true, settings: { workspaceUrl: "https://craftmyfunnel.live", extensionKey: "key", syncToken: "token" } },
            CMF_UPDATE_ASSISTANT_STATE: { ok: true },
            CMF_CHECK_CONNECTION: { ok: true, user: { email: "me@example.com" }, team: { name: "Team A" } },
            CMF_LIST_DUE_STEPS: { ok: true, steps: [omar, jane] },
            CMF_MARK_STEP_DONE: { ok: true, sequenceResumed: true, activityLog: [] },
        };
    });

    it("opens on the Due tab with the current profile's step first", async () => {
        await openPopup("https://www.linkedin.com/in/Jane-Doe/?miniProfile=1");

        expect(document.getElementById("dueTab")?.textContent).toBe("Due (2)");
        expect(activeTab()).toBe("due");
        expect(items().map((item) => item.querySelector("strong")?.textContent)).toEqual(["Jane Doe", "Omar Ali"]);
        expect(items()[0].textContent).toContain("Hi Jane");
        expect(button(items()[0], "Put in message box")).toBeDefined();
        expect(button(items()[0], "Open profile")).toBeUndefined();
        // A step with no message offers nothing to copy or place.
        expect(button(items()[1], "Copy message")).toBeUndefined();
    });

    it("stays on the capture tab when the current page has no due step", async () => {
        await openPopup("https://www.linkedin.com/in/someone-else/");

        expect(activeTab()).toBe("prep");
        expect(document.getElementById("dueTab")?.textContent).toBe("Due (2)");
        expect(button(items()[1], "Put in message box")).toBeUndefined();
    });

    it("opens another person's profile in a new tab", async () => {
        await openPopup("https://www.linkedin.com/in/jane-doe/");

        button(items()[1], "Open profile")!.click();

        expect(chrome.tabs.create).toHaveBeenCalledWith({ url: "https://www.linkedin.com/in/omar-ali/" });
    });

    it("hands the draft to the profile page", async () => {
        await openPopup("https://www.linkedin.com/in/jane-doe/");

        button(items()[0], "Put in message box")!.click();

        expect(chrome.tabs.sendMessage).toHaveBeenCalledWith(7, { type: "CMF_SHOW_DRAFT", name: "Jane Doe", message: "Hi Jane" }, expect.any(Function));
        expect(document.getElementById("statusMsg")?.textContent).toContain("Click Message on the profile");
    });

    it("marks a step done and reloads the list", async () => {
        await openPopup("https://www.linkedin.com/in/jane-doe/");
        background.CMF_MARK_STEP_DONE = () => {
            background.CMF_LIST_DUE_STEPS = { ok: true, steps: [omar] };
            return { ok: true, sequenceResumed: true, activityLog: [] };
        };

        button(items()[0], "Mark done")!.click();
        await settle();

        expect(chrome.runtime.sendMessage).toHaveBeenCalledWith({ type: "CMF_MARK_STEP_DONE", runId: "run-jane" });
        expect(items()).toHaveLength(1);
        expect(document.getElementById("dueTab")?.textContent).toBe("Due (1)");
        expect(document.getElementById("statusMsg")?.textContent).toBe("Marked done. The sequence moves on to its next step.");
    });

    it("says why the list is empty when the extension is not connected", async () => {
        background.CMF_LIST_DUE_STEPS = { ok: false, error: "Connect CraftMyFunnel in Settings to see your due steps." };
        await openPopup("https://www.linkedin.com/in/jane-doe/");

        expect(items()).toHaveLength(0);
        expect(document.getElementById("dueStepsHint")?.textContent).toBe("Connect CraftMyFunnel in Settings to see your due steps.");
        expect(document.getElementById("dueTab")?.textContent).toBe("Due");
    });
});
