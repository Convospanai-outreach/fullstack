import fs from "node:fs";
import path from "node:path";
import vm from "node:vm";
import { describe, expect, it, vi } from "vitest";

// Runs the shipped background.js against a stand-in for the chrome APIs it uses, so the
// popup's messages go through the real handlers.
const extDir = path.resolve(__dirname, "..");
const read = (file: string) => fs.readFileSync(path.join(extDir, file), "utf8");

const connected = { workspaceUrl: "https://craftmyfunnel.live", syncToken: "token-1" };

type Listener = (msg: any, sender: any, respond: (value: any) => void) => unknown;

function loadBackground(settings: Record<string, any> = connected, saved: Record<string, any> = {}) {
    const storage: Record<string, any> = { settings, ...saved };
    const listeners: Listener[] = [];
    const externalListeners: Listener[] = [];
    const fetchMock = vi.fn(async (_url: string, _init?: any) => ({ ok: true, status: 200, json: async () => ({ success: true }) }));
    const chrome = {
        runtime: {
            onInstalled: { addListener: () => undefined },
            onMessage: { addListener: (listener: any) => listeners.push(listener) },
            onMessageExternal: { addListener: (listener: any) => externalListeners.push(listener) },
            getManifest: () => ({ version: "1.2.0" }),
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
    const sendExternal = (msg: any, sender: any) => new Promise<any>((resolve) => externalListeners[0](msg, sender, resolve));
    return { send, sendExternal, fetchMock, storage };
}

const settle = async () => {
    for (let i = 0; i < 10; i++) await new Promise((resolve) => setTimeout(resolve, 0));
};

describe("extension background: due LinkedIn steps", () => {
    it("lists the due steps from the workspace with the saved sync token", async () => {
        const { send, fetchMock } = loadBackground();
        fetchMock.mockResolvedValueOnce({ ok: true, status: 200, json: async () => ({ success: true, steps: [{ runId: "run-1", name: "Jane Doe" }] }) });

        const response = await send({ type: "CMF_LIST_DUE_STEPS" });

        expect(response).toEqual({ ok: true, steps: [{ runId: "run-1", name: "Jane Doe" }] });
        const [url, init] = fetchMock.mock.calls[0];
        expect(url).toBe("https://craftmyfunnel.live/api/extension/steps");
        expect(init.headers).toEqual({ "Content-Type": "application/json", Authorization: "Bearer token-1" });
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
        const { send, fetchMock } = loadBackground({ workspaceUrl: "https://craftmyfunnel.live", syncToken: "" });

        expect((await send({ type: "CMF_LIST_DUE_STEPS" })).ok).toBe(false);
        expect((await send({ type: "CMF_MARK_STEP_DONE", runId: "run-1" })).ok).toBe(false);
        expect(fetchMock).not.toHaveBeenCalled();
    });
});

describe("extension background: requests to the workspace", () => {
    it("sends only the sync token, never the old extension key, even when one is still saved", async () => {
        const { send, fetchMock } = loadBackground({ ...connected, extensionKey: "old-key" }, { savedLead: { leadId: "lead-1", status: "synced" } });

        await send({ type: "CMF_SAVE_PREPARED_LEAD", payload: { name: "Jane" } });
        await send({ type: "CMF_MARK_LINKEDIN_OUTREACH_DONE", leadId: "lead-1" });
        await send({ type: "CMF_CHECK_CONNECTION" });
        await send({ type: "CMF_LIST_SEQUENCES" });
        await send({ type: "CMF_ADD_TO_SEQUENCE", leadId: "lead-1", sequenceId: "seq-1" });

        expect(fetchMock).toHaveBeenCalledTimes(5);
        for (const [, init] of fetchMock.mock.calls) {
            expect(init.headers).toEqual({ "Content-Type": "application/json", Authorization: "Bearer token-1" });
        }
    });

    it("keeps a lead for later, without calling the workspace, before the extension is connected", async () => {
        const { send, fetchMock, storage } = loadBackground({ workspaceUrl: "https://craftmyfunnel.live", syncToken: "" });

        const response = await send({ type: "CMF_SAVE_PREPARED_LEAD", payload: { name: "Jane", profileUrl: "https://www.linkedin.com/in/jane/" } });

        expect(fetchMock).not.toHaveBeenCalled();
        expect(response).toMatchObject({ ok: true, synced: false, status: "pending_sync" });
        expect(response.message).toBe("Saved here. It will send to CraftMyFunnel when you connect the extension.");
        expect(storage.savedLead.status).toBe("pending_sync");
        expect(storage.settings.needsReconnect).toBeFalsy();
    });

    it("asks to reconnect when the workspace no longer accepts the sync token", async () => {
        const { send, fetchMock, storage } = loadBackground();
        fetchMock.mockResolvedValueOnce({ ok: false, status: 401, json: async () => ({ success: false, error: "Invalid token", code: "INVALID_TOKEN" }) });

        expect(await send({ type: "CMF_LIST_DUE_STEPS" })).toEqual({ ok: false, error: "Invalid token" });
        expect(storage.settings.needsReconnect).toBe(true);
        expect(storage.settings.syncToken).toBe("token-1");

        // A successful check clears it again.
        fetchMock.mockResolvedValueOnce({ ok: true, status: 200, json: async () => ({ valid: true, team: { name: "Team A" } }) });
        expect((await send({ type: "CMF_CHECK_CONNECTION" })).ok).toBe(true);
        expect(storage.settings.needsReconnect).toBe(false);
    });

    it("does not ask to reconnect for other refusals", async () => {
        const { send, fetchMock, storage } = loadBackground();
        fetchMock.mockResolvedValueOnce({ ok: false, status: 403, json: async () => ({ success: false, error: "Not in team", code: "FORBIDDEN" }) });
        fetchMock.mockResolvedValueOnce({ ok: false, status: 500, json: async () => ({ success: false, error: "Oops", code: "INVALID_TOKEN" }) });

        await send({ type: "CMF_LIST_SEQUENCES" });
        await send({ type: "CMF_LIST_DUE_STEPS" });

        expect(storage.settings.needsReconnect).toBeFalsy();
    });

    it("asks to reconnect when a saved profile is refused because the sync token no longer works", async () => {
        const { send, fetchMock, storage } = loadBackground();
        fetchMock.mockResolvedValueOnce({ ok: false, status: 401, json: async () => ({ success: false, error: "Invalid token", code: "INVALID_TOKEN" }) });

        const response = await send({ type: "CMF_SAVE_PREPARED_LEAD", payload: { name: "Jane", profileUrl: "https://www.linkedin.com/in/jane/" } });

        expect(response).toMatchObject({ ok: true, synced: false, status: "pending_sync" });
        expect(response.message).toBe("Saved here. Your connection to CraftMyFunnel has ended; click Reconnect in Settings to send it.");
        expect(storage.settings.needsReconnect).toBe(true);
    });

    it("forgets the site's connection details when a different sync token is typed in", async () => {
        const { send, storage } = loadBackground({ ...connected, team: { id: "t1", name: "Team A" }, syncTokenExpiresAt: "2026-12-01T00:00:00.000Z", needsReconnect: true });

        await send({ type: "CMF_UPDATE_ASSISTANT_STATE", patch: { settings: { workspaceUrl: "https://app.example.com", syncToken: "typed-token" } } });

        expect(storage.settings).toMatchObject({ workspaceUrl: "https://app.example.com", syncToken: "typed-token", team: null, syncTokenExpiresAt: "", needsReconnect: false });
    });
});

describe("extension background: connect from the CraftMyFunnel site", () => {
    const apex = { origin: "https://craftmyfunnel.live", url: "https://craftmyfunnel.live/extension/connect?ext=abc" };
    const www = { origin: "https://www.craftmyfunnel.live", url: "https://www.craftmyfunnel.live/extension/connect?ext=abc" };
    const connectMsg = (workspaceUrl = "https://craftmyfunnel.live", extra: Record<string, any> = {}) => ({
        type: "CMF_CONNECT",
        version: 1,
        workspaceUrl,
        syncToken: "new-token",
        expiresAt: "2026-12-01T00:00:00.000Z",
        team: { id: "team-1", name: "Team A" },
        ...extra,
    });
    const notConnected = { workspaceUrl: "", syncToken: "", extensionKey: "old-key" };

    it("answers a ping with the version and whether it is connected", async () => {
        expect(await loadBackground(notConnected).sendExternal({ type: "CMF_PING" }, apex)).toEqual({ ok: true, version: "1.2.0", connected: false });
        expect(await loadBackground().sendExternal({ type: "CMF_PING" }, www)).toEqual({ ok: true, version: "1.2.0", connected: true });
    });

    it("saves the sync token handed over by the site and clears the old extension key", async () => {
        const { sendExternal, storage } = loadBackground({ ...notConnected, needsReconnect: true });

        expect(await sendExternal(connectMsg(), apex)).toEqual({ ok: true, version: "1.2.0" });

        expect(storage.settings).toMatchObject({
            workspaceUrl: "https://craftmyfunnel.live",
            syncToken: "new-token",
            syncTokenExpiresAt: "2026-12-01T00:00:00.000Z",
            team: { id: "team-1", name: "Team A" },
            extensionKey: "",
            needsReconnect: false,
        });
        expect(storage.activityLog[0].message).toBe("Connected to Team A");
    });

    it("saves the bare domain when the page was on www", async () => {
        const { sendExternal, storage } = loadBackground(notConnected);

        expect((await sendExternal(connectMsg("https://www.craftmyfunnel.live"), www)).ok).toBe(true);
        expect(storage.settings.workspaceUrl).toBe("https://craftmyfunnel.live");
    });

    it("refuses pages on any other site", async () => {
        const senders = [
            { origin: "https://example.com", url: "https://example.com/extension/connect" },
            { origin: "https://craftmyfunnel.live.example.com", url: "https://craftmyfunnel.live.example.com/extension/connect" },
            { origin: "http://craftmyfunnel.live", url: "http://craftmyfunnel.live/extension/connect" },
            { origin: "https://craftmyfunnel.live", url: "https://craftmyfunnel.live.example.com/extension/connect" },
            { url: "https://craftmyfunnel.live/extension/connect" },
            {},
        ];
        for (const sender of senders) {
            const { sendExternal, storage } = loadBackground(notConnected);
            expect((await sendExternal(connectMsg(), sender)).ok).toBe(false);
            expect((await sendExternal({ type: "CMF_PING" }, sender)).ok).toBe(false);
            expect(storage.settings.syncToken).toBe("");
        }
    });

    it("refuses other pages on the CraftMyFunnel site", async () => {
        const senders = [
            { origin: "https://craftmyfunnel.live", url: "https://craftmyfunnel.live/p/some-slug" },
            { origin: "https://craftmyfunnel.live", url: "https://craftmyfunnel.live/" },
            { origin: "https://www.craftmyfunnel.live", url: "https://www.craftmyfunnel.live/extension/connect/other" },
        ];
        for (const sender of senders) {
            const { sendExternal, storage } = loadBackground(notConnected);
            expect((await sendExternal(connectMsg(), sender)).ok).toBe(false);
            expect((await sendExternal({ type: "CMF_PING" }, sender)).ok).toBe(false);
            expect(storage.settings.syncToken).toBe("");
        }
    });

    it("refuses a workspace address that is not the site the page is on", async () => {
        for (const workspaceUrl of ["https://example.com", "https://craftmyfunnel.live.example.com", "http://craftmyfunnel.live", undefined]) {
            const { sendExternal, storage } = loadBackground(notConnected);
            const response = await sendExternal(connectMsg("https://craftmyfunnel.live", { workspaceUrl }), apex);
            expect(response.ok).toBe(false);
            expect(storage.settings.syncToken).toBe("");
        }
    });

    it("refuses a request without a usable token, expiry or version", async () => {
        for (const extra of [{ syncToken: "" }, { syncToken: 42 }, { expiresAt: "soon" }, { version: 2 }]) {
            const { sendExternal, storage } = loadBackground(notConnected);
            expect((await sendExternal(connectMsg("https://craftmyfunnel.live", extra), apex)).ok).toBe(false);
            expect(storage.settings.syncToken).toBe("");
        }
    });

    it("sends the lead that was waiting once it is connected", async () => {
        const pending = { name: "Jane", profileUrl: "https://www.linkedin.com/in/jane/", status: "pending_sync", leadId: "", syncError: "Not connected to CraftMyFunnel yet." };
        const { sendExternal, fetchMock, storage } = loadBackground(notConnected, { savedLead: pending });
        fetchMock.mockResolvedValueOnce({ ok: true, status: 200, json: async () => ({ success: true, leadId: "lead-9" }) });

        expect((await sendExternal(connectMsg(), apex)).ok).toBe(true);
        await settle();

        const [url, init] = fetchMock.mock.calls[0];
        expect(url).toBe("https://craftmyfunnel.live/api/extension/leads/capture");
        expect(init.headers).toEqual({ "Content-Type": "application/json", Authorization: "Bearer new-token" });
        const body = JSON.parse(init.body);
        expect(body).toMatchObject({ name: "Jane", linkedinUrl: "https://www.linkedin.com/in/jane/" });
        expect(body.status).toBeUndefined();
        expect(body.syncError).toBeUndefined();
        expect(storage.savedLead).toMatchObject({ status: "synced", leadId: "lead-9", syncError: "" });
        expect(storage.activityLog[0].message).toBe("Lead synced to workspace");
    });

    it("keeps a profile saved while the waiting one was being sent", async () => {
        const pending = { name: "Jane", profileUrl: "https://www.linkedin.com/in/jane/", status: "pending_sync", savedAt: "2026-10-27T09:00:00.000Z" };
        const { sendExternal, fetchMock, storage } = loadBackground(notConnected, { savedLead: pending });
        let finish: (value: any) => void = () => undefined;
        fetchMock.mockImplementationOnce(() => new Promise((resolve) => { finish = resolve; }));

        await sendExternal(connectMsg(), apex);
        await settle();
        const newer = { name: "Ann", profileUrl: "https://www.linkedin.com/in/ann/", status: "pending_sync", savedAt: "2026-10-27T10:00:00.000Z" };
        storage.savedLead = newer;
        finish({ ok: true, status: 200, json: async () => ({ success: true, leadId: "lead-9" }) });
        await settle();

        expect(storage.savedLead).toEqual(newer);
    });

    it("leaves an already synced lead alone", async () => {
        const { sendExternal, fetchMock } = loadBackground(notConnected, { savedLead: { name: "Jane", status: "synced", leadId: "lead-1" } });

        await sendExternal(connectMsg(), apex);
        await settle();

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

    it("lets only the CraftMyFunnel site talk to the extension", () => {
        expect(manifest.externally_connectable).toEqual({ matches: ["https://craftmyfunnel.live/*", "https://www.craftmyfunnel.live/*"] });
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
