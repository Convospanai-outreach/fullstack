let USER_TOKEN = null;
let EXTENSION_KEY = null;
let API_URL = "http://localhost:3000/api/proxy/extension";
let OFFLINE_QUEUE = [];
const PENDING_TASKS_BY_TAB = {};

function normalizedAuthorization(token) {
    if (!token) return null;
    return token.toLowerCase().startsWith("bearer ") ? token : `Bearer ${token}`;
}

function buildHeaders({ json = false } = {}) {
    const headers = {};
    if (json) headers["Content-Type"] = "application/json";
    const auth = normalizedAuthorization(USER_TOKEN);
    if (auth) headers.Authorization = auth;
    if (EXTENSION_KEY) headers["x-extension-key"] = EXTENSION_KEY;
    return headers;
}

function persistState() {
    chrome.storage.local.set({
        userToken: USER_TOKEN,
        extensionKey: EXTENSION_KEY,
        apiUrl: API_URL,
        offlineQueue: OFFLINE_QUEUE
    });
}

function hasAuthConfig() {
    return Boolean(USER_TOKEN && EXTENSION_KEY);
}

async function findBestLinkedInTab() {
    const activeTabs = await chrome.tabs.query({ active: true, currentWindow: true });
    if (activeTabs[0]?.id && activeTabs[0]?.url?.includes("linkedin.com")) {
        return activeTabs[0];
    }

    const linkedinTabs = await chrome.tabs.query({ url: ["https://www.linkedin.com/*"] });
    if (linkedinTabs[0]?.id) return linkedinTabs[0];

    return null;
}

async function sendMessageToTab(tabId, message) {
    return new Promise((resolve) => {
        chrome.tabs.sendMessage(tabId, message, (response) => {
            if (chrome.runtime.lastError) {
                resolve({ ok: false, error: chrome.runtime.lastError.message });
                return;
            }
            resolve({ ok: true, response });
        });
    });
}

async function postJson(path, payload) {
    const response = await fetch(`${API_URL}/${path}`, {
        method: "POST",
        headers: buildHeaders({ json: true }),
        body: JSON.stringify(payload)
    });
    const data = await response.json().catch(() => ({}));
    return { ok: response.ok, status: response.status, data };
}

async function recordTaskCompletion(payload) {
    return postJson("tasks/complete", payload);
}

async function recordExtensionAction(payload) {
    return postJson("action", payload);
}

async function ensureTaskTab(task) {
    const existing = await findBestLinkedInTab();
    if (existing?.id) return existing;

    const url = task?.payload?.url || "https://www.linkedin.com/feed/";
    return chrome.tabs.create({ url, active: true });
}

async function executeTask(task) {
    const tab = await ensureTaskTab(task);
    if (!tab?.id) {
        return { ok: false, error: "Unable to open LinkedIn tab" };
    }

    const delivery = await sendMessageToTab(tab.id, { type: "EXECUTE_TASK", task });
    if (!delivery.ok) {
        PENDING_TASKS_BY_TAB[tab.id] = task;
        if (task?.payload?.url) {
            await chrome.tabs.update(tab.id, { url: task.payload.url });
            return { ok: true, deferred: true, reason: "tab_navigating" };
        }
        return { ok: false, error: delivery.error };
    }

    const result = delivery.response || {};
    if (result.pending && result.navigateTo) {
        PENDING_TASKS_BY_TAB[tab.id] = task;
        await chrome.tabs.update(tab.id, { url: result.navigateTo });
        return { ok: true, deferred: true, reason: "awaiting_navigation" };
    }

    return { ok: true, immediateResult: result };
}

async function pollTasks() {
    if (!hasAuthConfig()) return;

    try {
        const response = await fetch(`${API_URL}/tasks`, {
            headers: buildHeaders()
        });
        if (!response.ok) return;

        const data = await response.json().catch(() => ({}));
        const tasks = Array.isArray(data.tasks) ? data.tasks : [];

        for (const task of tasks) {
            await executeTask(task);
        }
    } catch (e) {
        console.warn("Polling failed:", e);
    }
}

async function processOfflineQueue() {
    if (OFFLINE_QUEUE.length === 0 || !hasAuthConfig()) return;

    const item = OFFLINE_QUEUE[0];
    try {
        const result = await postJson("push", item);
        if (result.ok) {
            OFFLINE_QUEUE.shift();
            persistState();
            processOfflineQueue();
        }
    } catch {
        // remain queued while offline
    }
}

chrome.runtime.onInstalled.addListener(() => {
    console.log("ConvoSpan LinkedIn Extension Installed");
    chrome.alarms.create("pollTasks", { periodInMinutes: 1 });
});

chrome.storage.local.get(["userToken", "extensionKey", "apiUrl", "offlineQueue"], (data) => {
    if (data.userToken) USER_TOKEN = data.userToken;
    if (data.extensionKey) EXTENSION_KEY = data.extensionKey;
    if (data.apiUrl) API_URL = data.apiUrl;
    if (Array.isArray(data.offlineQueue)) OFFLINE_QUEUE = data.offlineQueue;
});

chrome.alarms.onAlarm.addListener((alarm) => {
    if (alarm.name === "pollTasks") {
        pollTasks();
        processOfflineQueue();
    }
});

chrome.tabs.onUpdated.addListener(async (tabId, info, tab) => {
    if (info.status !== "complete") return;
    const pendingTask = PENDING_TASKS_BY_TAB[tabId];
    if (!pendingTask) return;
    if (!tab?.url?.includes("linkedin.com")) return;

    const delivery = await sendMessageToTab(tabId, { type: "EXECUTE_TASK", task: pendingTask });
    if (delivery.ok && delivery.response && !delivery.response.pending) {
        delete PENDING_TASKS_BY_TAB[tabId];
    }
});

chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
    if (msg.type === "SET_CONFIG") {
        USER_TOKEN = msg.token || USER_TOKEN;
        EXTENSION_KEY = msg.extensionKey || EXTENSION_KEY;
        API_URL = msg.apiUrl || API_URL;
        persistState();
        sendResponse({ ok: true });
        return true;
    }

    if (msg.type === "GET_CONFIG") {
        sendResponse({
            token: USER_TOKEN,
            extensionKey: EXTENSION_KEY,
            apiUrl: API_URL
        });
        return true;
    }

    if (msg.type === "VALIDATE_AUTH") {
        if (!hasAuthConfig()) {
            sendResponse({ ok: false, error: "Token and extension key are required." });
            return true;
        }

        fetch(`${API_URL}/auth/validate`, {
            method: "GET",
            headers: buildHeaders()
        })
            .then(async (res) => {
                const data = await res.json().catch(() => ({}));
                sendResponse({
                    ok: res.ok && !!data.valid,
                    data,
                    error: data?.error
                });
            })
            .catch((error) => {
                sendResponse({ ok: false, error: error?.message || "Validation failed" });
            });

        return true;
    }

    if (msg.type === "SCRAPE_PROFILE") {
        const payload = msg.data || msg;
        postJson("push", payload)
            .then((result) => {
                if (result.ok) {
                    sendResponse({ ok: true, ...result.data });
                    return;
                }
                OFFLINE_QUEUE.push(payload);
                persistState();
                sendResponse({ ok: true, offline: true, error: result.data?.error });
            })
            .catch((error) => {
                OFFLINE_QUEUE.push(payload);
                persistState();
                sendResponse({ ok: true, offline: true, error: error?.message });
            });
        return true;
    }

    if (msg.type === "TASK_COMPLETE") {
        const payload = msg.data || msg;
        recordTaskCompletion(payload)
            .then((result) => sendResponse(result.ok ? { ok: true, ...result.data } : { ok: false, error: result.data?.error || "Failed" }))
            .catch((error) => sendResponse({ ok: false, error: error?.message || "Failed" }));
        return true;
    }

    if (msg.type === "EXTENSION_ACTION") {
        const payload = msg.data || msg;
        recordExtensionAction(payload)
            .then((result) => sendResponse(result.ok ? { ok: true, ...result.data } : { ok: false, error: result.data?.error || "Failed" }))
            .catch((error) => sendResponse({ ok: false, error: error?.message || "Failed" }));
        return true;
    }
});
