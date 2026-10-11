import fs from "node:fs";
import path from "node:path";
import vm from "node:vm";
import { describe, expect, it, vi } from "vitest";

// Runs the shipped background.js against a stand-in for the chrome APIs it uses, so the
// popup's messages go through the real handlers.
const extDir = path.resolve(__dirname, "..");
const read = (file: string) => fs.readFileSync(path.join(extDir, file), "utf8");

const connected = { workspaceUrl: "https://craftmyfunnel.live", extensionKey: "key-1", syncToken: "token-1" };

function loadBackground(settings: Record<string, string> = connected) {
    const storage: Record<string, any> = { settings };
    const listeners: Array<(msg: any, sender: any, respond: (value: any) => void) => unknown> = [];
    const fetchMock = vi.fn(async (_url: string, _init?: any) => ({ ok: true, status: 200, json: async () => ({ success: true }) }));
    const chrome = {
        runtime: {
            onInstalled: { addListener: () => undefined },
            onMessage: { addListener: (listener: any) => listeners.push(listener) },
        },
        storage: {
            local: {
                get: async (keys: string[]) => Object.fromEntries(keys.filter((key) => key in storage).map((key) => [key, storage[key]])),
                set: async (patch: Record<string, any>) => void Object.assign(storage, patch),
            },
        },
        action: { setBadgeText: () => undefined, setBadgeBackgroundColor: () => undefined },
    };
    vm.runInNewContext(read("background.js"), { chrome, fetch: fetchMock, URL, console });
    const send = (msg: any) => new Promise<any>((resolve) => listeners[0](msg, {}, resolve));
    return { send, fetchMock, storage };
}

describe("extension background: due LinkedIn steps", () => {
    it("lists the due steps from the workspace with the saved sync token", async () => {
        const { send, fetchMock } = loadBackground();
        fetchMock.mockResolvedValueOnce({ ok: true, status: 200, json: async () => ({ success: true, steps: [{ runId: "run-1", name: "Jane Doe" }] }) });

        const response = await send({ type: "CMF_LIST_DUE_STEPS" });

        expect(response).toEqual({ ok: true, steps: [{ runId: "run-1", name: "Jane Doe" }] });
        const [url, init] = fetchMock.mock.calls[0];
        expect(url).toBe("https://craftmyfunnel.live/api/extension/steps");
        expect(init.headers).toMatchObject({ Authorization: "Bearer token-1", "x-extension-key": "key-1" });
    });

    it("marks one step done and notes it in the activity log", async () => {
        const { send, fetchMock, storage } = loadBackground();
        fetchMock.mockResolvedValueOnce({ ok: true, status: 200, json: async () => ({ success: true, action: "Send invitation", sequenceResumed: true }) });

        const response = await send({ type: "CMF_MARK_STEP_DONE", runId: "run/1" });

        expect(response).toMatchObject({ ok: true, sequenceResumed: true });
        const [url, init] = fetchMock.mock.calls[0];
        expect(url).toBe("https://craftmyfunnel.live/api/extension/steps/run%2F1/done");
        expect(init.method).toBe("POST");
        expect(storage.activityLog[0].message).toBe("LinkedIn step done: Send invitation");
    });

    it("passes on the workspace's refusal", async () => {
        const { send, fetchMock } = loadBackground();
        fetchMock.mockResolvedValueOnce({ ok: false, status: 404, json: async () => ({ success: false, error: "Step not found" }) });

        expect(await send({ type: "CMF_MARK_STEP_DONE", runId: "run-1" })).toEqual({ ok: false, error: "Step not found" });
    });

    it("asks for the connection instead of calling the workspace when it is not set up", async () => {
        const { send, fetchMock } = loadBackground({ workspaceUrl: "https://craftmyfunnel.live", extensionKey: "", syncToken: "" });

        expect((await send({ type: "CMF_LIST_DUE_STEPS" })).ok).toBe(false);
        expect((await send({ type: "CMF_MARK_STEP_DONE", runId: "run-1" })).ok).toBe(false);
        expect(fetchMock).not.toHaveBeenCalled();
    });
});

describe("extension background: workspace address", () => {
    const urlFor = async (workspaceUrl: string, msg: any) => {
        const { send, fetchMock } = loadBackground({ ...connected, workspaceUrl });
        await send(msg);
        return fetchMock.mock.calls[0][0];
    };

    it("sends requests to the bare domain when the www address was saved", async () => {
        expect(await urlFor("https://www.craftmyfunnel.live/", { type: "CMF_LIST_DUE_STEPS" })).toBe("https://craftmyfunnel.live/api/extension/steps");
        expect(await urlFor("https://WWW.craftmyfunnel.live", { type: "CMF_CHECK_CONNECTION" })).toBe("https://craftmyfunnel.live/api/extension/auth/validate");
        expect(await urlFor("https://www.craftmyfunnel.live", { type: "CMF_SAVE_PREPARED_LEAD", payload: { name: "Jane" } })).toBe("https://craftmyfunnel.live/api/extension/leads/capture");
    });

    it("leaves any other address as it was typed, without the trailing slash", async () => {
        expect(await urlFor("https://app.example.com/", { type: "CMF_LIST_DUE_STEPS" })).toBe("https://app.example.com/api/extension/steps");
    });
});

describe("extension background: captured profile address", () => {
    const capture = (profileUrl: string) => loadBackground().send({ type: "CMF_STORE_VISIBLE_PROFILE", profile: { name: "Jane Doe", profileUrl } });

    it("takes a profile on linkedin.com and refuses a look-alike domain", async () => {
        expect((await capture("https://www.linkedin.com/in/jane-doe/")).ok).toBe(true);
        expect((await capture("https://linkedin.com/in/jane-doe/")).ok).toBe(true);
        expect((await capture("https://notlinkedin.com/in/jane-doe/")).ok).toBe(false);
    });
});

describe("published manifest", () => {
    const manifest = JSON.parse(read("manifest.json"));

    it("asks for nothing new: the same permissions and the LinkedIn profile host only", () => {
        expect(manifest.permissions).toEqual(["activeTab", "storage"]);
        expect(manifest.host_permissions).toEqual(["https://www.linkedin.com/in/*"]);
        expect(manifest.optional_host_permissions).toBeUndefined();
        expect(manifest.content_scripts[0].matches).toEqual(["https://www.linkedin.com/in/*"]);
    });

    it("has a version above the first store build", () => {
        const [major, minor] = manifest.version.split(".").map(Number);
        expect(major * 1000 + minor).toBeGreaterThan(1000);
    });

    it("ships no background polling and opens no tab from the background", () => {
        const background = read("background.js");
        for (const gone of ["chrome.alarms", "chrome.tabs", "chrome.notifications", "tasks/pending", "EXECUTE_TASK"]) {
            expect(background).not.toContain(gone);
        }
        expect(manifest.options_page).toBeUndefined();
    });

    it("never clicks or presses a key on the page", () => {
        const content = read("content.js");
        // A click or a synthetic Enter could send a message; the person always sends it themselves.
        expect(content).not.toContain(".click(");
        expect(content).not.toContain("KeyboardEvent");
        expect(content).not.toContain("EXECUTE_TASK");
    });

    it("keeps the settings where the first build saved them", () => {
        const background = read("background.js");
        for (const key of ["workspaceUrl", "extensionKey", "syncToken"]) {
            expect(background).toMatch(new RegExp(`settings: \\{[^}]*${key}: ""`));
        }
    });
});
