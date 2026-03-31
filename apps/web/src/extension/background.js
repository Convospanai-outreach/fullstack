let USER_TOKEN = null;
let EXTENSION_KEY = null;
let API_URL = "http://localhost:3000/api/proxy/extension";
let OFFLINE_QUEUE = [];

function buildHeaders({ json = false } = {}) {
    const headers = {};
    if (json) headers["Content-Type"] = "application/json";
    if (USER_TOKEN) headers.Authorization = USER_TOKEN;
    if (EXTENSION_KEY) headers["x-extension-key"] = EXTENSION_KEY;
    return headers;
}

// Initialize
chrome.runtime.onInstalled.addListener(() => {
    console.log("ConvoSpan LinkedIn Extension Installed");
    // Setup polling every 1 minute
    chrome.alarms.create("pollTasks", { periodInMinutes: 1 });
});

// Load extension config on startup
chrome.storage.local.get(["userToken", "extensionKey", "apiUrl", "offlineQueue"], (data) => {
    if (data.userToken) USER_TOKEN = data.userToken;
    if (data.extensionKey) EXTENSION_KEY = data.extensionKey;
    if (data.apiUrl) API_URL = data.apiUrl;
    if (data.offlineQueue) OFFLINE_QUEUE = data.offlineQueue || [];
});

// Alarm Listener (Polling)
chrome.alarms.onAlarm.addListener((alarm) => {
    if (alarm.name === "pollTasks") {
        pollTasks();
        processOfflineQueue();
    }
});

async function pollTasks() {
    if (!USER_TOKEN || !EXTENSION_KEY) return;

    try {
        const response = await fetch(`${API_URL}/tasks`, {
            headers: buildHeaders()
        });

        if (response.ok) {
            const data = await response.json();
            if (data.tasks && data.tasks.length > 0) {
                // Determine active tab to execute
                const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
                if (tabs[0]?.id) {
                    // For now, just execute the first task on the active tab
                    const task = data.tasks[0];
                    chrome.tabs.sendMessage(tabs[0].id, { type: "EXECUTE_TASK", task });
                }
            }
        }
    } catch (e) {
        console.warn("Polling failed:", e);
    }
}

async function processOfflineQueue() {
    if (OFFLINE_QUEUE.length === 0 || !USER_TOKEN || !EXTENSION_KEY) return;

    // Try to send first item
    const item = OFFLINE_QUEUE[0];
    try {
        const response = await fetch(`${API_URL}/push`, {
            method: "POST",
            headers: buildHeaders({ json: true }),
            body: JSON.stringify(item)
        });

        if (response.ok) {
            // Success, remove from queue
            OFFLINE_QUEUE.shift();
            chrome.storage.local.set({ offlineQueue: OFFLINE_QUEUE });
            // Recurse to process next
            processOfflineQueue();
        }
    } catch {
        // Still offline, stop
    }
}

chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
    if (msg.type === "SET_TOKEN") {
        USER_TOKEN = msg.token;
        chrome.storage.local.set({ userToken: msg.token }, () => {
            sendResponse({ ok: true });
            pollTasks(); // Try immediately
        });
        return true;
    }

    if (msg.type === "SET_CONFIG") {
        USER_TOKEN = msg.token || USER_TOKEN;
        EXTENSION_KEY = msg.extensionKey || EXTENSION_KEY;
        API_URL = msg.apiUrl || API_URL;

        chrome.storage.local.set(
            {
                userToken: USER_TOKEN,
                extensionKey: EXTENSION_KEY,
                apiUrl: API_URL
            },
            () => sendResponse({ ok: true })
        );
        return true;
    }

    if (msg.type === "GET_TOKEN") {
        sendResponse({ token: USER_TOKEN });
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
        if (!USER_TOKEN || !EXTENSION_KEY) {
            sendResponse({ ok: false, error: "Token and extension key are required." });
            return true;
        }

        fetch(`${API_URL}/auth/validate`, {
            method: "GET",
            headers: buildHeaders()
        }).then(async (res) => {
            const data = await res.json().catch(() => ({}));
            sendResponse({ ok: res.ok && !!data.valid, data });
        }).catch((error) => {
            sendResponse({ ok: false, error: error?.message || "Validation failed" });
        });

        return true;
    }

    if (msg.type === "SCRAPE_PROFILE" || msg.type === "TASK_COMPLETE") {
        const payload = msg.data || msg;

        // Try direct send
        fetch(`${API_URL}/${msg.type === "TASK_COMPLETE" ? "tasks/complete" : "push"}`, {
            method: "POST",
            headers: buildHeaders({ json: true }),
            body: JSON.stringify(payload)
        }).then(res => res.json())
            .then(data => sendResponse(data))
            .catch(err => {
                // Add to offline queue if it's a critical push event
                if (msg.type === "SCRAPE_PROFILE") {
                    OFFLINE_QUEUE.push(payload);
                    chrome.storage.local.set({ offlineQueue: OFFLINE_QUEUE });
                    sendResponse({ ok: true, offline: true });
                } else {
                    sendResponse({ ok: false, error: err.message });
                }
            });

        return true;
    }

    // Pass-through for other actions if needed
});
