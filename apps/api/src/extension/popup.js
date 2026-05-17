document.addEventListener("DOMContentLoaded", () => {
    void initializePopup();
});

async function initializePopup() {
    const tokenInput = document.getElementById("tokenInput");
    const saveBtn = document.getElementById("saveToken");
    const scrapeBtn = document.getElementById("scrapeProfile");
    const likeBtn = document.getElementById("likePost");
    const loginSection = document.getElementById("loginSection");
    const actionsSection = document.getElementById("actionsSection");
    const statusMsg = document.getElementById("statusMsg");
    const apiBaseInput = document.getElementById("apiBaseInput");
    const extensionKeyInput = document.getElementById("extensionKeyInput");
    const logoutBtn = document.getElementById("logoutBtn");
    const teamSelect = document.getElementById("teamSelect");
    const capRatio = document.getElementById("capRatio");
    const capBar = document.getElementById("capBar");

    const requiredElements = [
        tokenInput,
        saveBtn,
        scrapeBtn,
        likeBtn,
        loginSection,
        actionsSection,
        statusMsg,
        apiBaseInput,
        extensionKeyInput,
        logoutBtn,
        teamSelect,
        capRatio,
        capBar,
    ];

    if (requiredElements.some((element) => !element)) {
        console.error("ConvoSpan extension popup is missing required DOM elements.");
        return;
    }

    const stored = await chrome.storage.local.get(["token", "teamId", "teamIds", "apiBase", "extensionKey"]);
    const defaultApiBase = stored.apiBase || "http://localhost:3000/api/proxy";
    const defaultExtensionKey = stored.extensionKey || "convo-ext-key-dev";
    apiBaseInput.value = defaultApiBase;
    extensionKeyInput.value = defaultExtensionKey;

    if (stored.token) {
        tokenInput.value = stored.token;
        renderTeams(stored.teamIds || [], stored.teamId);
        showActions();
        await fetchCaps();
    }

    saveBtn.addEventListener("click", async () => {
        const token = tokenInput.value.trim();
        const apiBase = normalizeApiBase(apiBaseInput.value) || defaultApiBase;
        const extensionKey = extensionKeyInput.value.trim() || defaultExtensionKey;
        if (!token) {
            setStatus("Please enter a session token.", "error");
            return;
        }

        setStatus("Validating...", "");

        try {
            const res = await fetch(`${apiBase}/extension/auth/validate`, {
                method: "GET",
                headers: {
                    "Content-Type": "application/json",
                    "x-extension-key": extensionKey,
                    "Authorization": `Bearer ${token}`,
                },
            });

            const data = await res.json();
            if (res.ok && data.valid) {
                const teamIds = data.teamIds || [];
                const teamId = teamIds.length > 0 ? teamIds[0] : null;

                await chrome.storage.local.set({ token, teamId, teamIds, apiBase, extensionKey });
                chrome.runtime.sendMessage({ type: "UPDATE_STATE", token, teamId, apiBase, extensionKey });

                renderTeams(teamIds, teamId);
                setStatus("Connected.", "success");
                showActions();
                await fetchCaps();
            } else {
                setStatus(data.error || "Validation failed.", "error");
            }
        } catch (error) {
            console.error("Extension validation failed", error);
            setStatus("Network error verifying token.", "error");
        }
    });

    logoutBtn.addEventListener("click", async () => {
        await chrome.storage.local.remove(["token", "teamId", "teamIds"]);
        chrome.runtime.sendMessage({ type: "LOGOUT" });
        location.reload();
    });

    teamSelect.addEventListener("change", async (event) => {
        const newTeamId = event.target.value;
        await chrome.storage.local.set({ teamId: newTeamId });
        chrome.runtime.sendMessage({ type: "UPDATE_STATE", teamId: newTeamId });
        await fetchCaps();
    });

    scrapeBtn.addEventListener("click", () => {
        chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
            if (tabs.length === 0) return;
            if (!tabs[0].url?.includes("linkedin.com")) {
                setStatus("Open LinkedIn before scraping.", "error");
                return;
            }
            chrome.tabs.sendMessage(tabs[0].id, { type: "SCRAPE_MANUAL" }, () => {
                if (chrome.runtime.lastError) {
                    setStatus("Please refresh the LinkedIn page first.", "error");
                } else {
                    setStatus("Scrape initiated.", "success");
                }
            });
        });
    });

    likeBtn.addEventListener("click", () => {
        chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
            if (tabs.length === 0) return;
            if (!tabs[0].url?.includes("linkedin.com")) {
                setStatus("Open LinkedIn before liking.", "error");
                return;
            }
            chrome.tabs.sendMessage(tabs[0].id, { type: "LIKE_MANUAL" }, () => {
                if (chrome.runtime.lastError) {
                    setStatus("Please refresh the LinkedIn page first.", "error");
                } else {
                    setStatus("Like initiated.", "success");
                }
            });
        });
    });

    async function fetchCaps() {
        const { token, teamId, apiBase: storedApiBase, extensionKey: storedExtensionKey } = await chrome.storage.local.get(["token", "teamId", "apiBase", "extensionKey"]);
        if (!token || !teamId) return;
        const apiBase = normalizeApiBase(apiBaseInput.value) || storedApiBase || defaultApiBase;
        const extensionKey = extensionKeyInput.value.trim() || storedExtensionKey || defaultExtensionKey;

        try {
            const res = await fetch(`${apiBase}/extension/tasks`, {
                method: "GET",
                headers: {
                    "Content-Type": "application/json",
                    "x-extension-key": extensionKey,
                    "Authorization": `Bearer ${token}`,
                    "x-team-id": teamId,
                },
            });

            if (!res.ok) return;

            const data = await res.json();
            const remaining = typeof data.remainingToday === "number" ? data.remainingToday : null;
            const capReached = data.capReached === true;
            capRatio.textContent = remaining === null ? "Ready" : `${remaining} left`;
            capBar.style.width = capReached ? "100%" : "0%";
            capBar.style.background = capReached ? "#ef4444" : "linear-gradient(to right, #3b82f6, #8b5cf6)";
        } catch (error) {
            console.error("Failed to fetch extension task caps", error);
        }
    }

    function renderTeams(ids, selectedId) {
        teamSelect.innerHTML = "";
        ids.forEach((id) => {
            const opt = document.createElement("option");
            opt.value = id;
            opt.textContent = `Team: ${id.substring(0, 8)}...`;
            if (id === selectedId) opt.selected = true;
            teamSelect.appendChild(opt);
        });
    }

    function setStatus(message, type) {
        statusMsg.textContent = message;
        statusMsg.className = `status ${type}`;
    }

    function showActions() {
        loginSection.style.display = "none";
        actionsSection.style.display = "block";
    }
}

function normalizeApiBase(value) {
    const trimmed = value.trim().replace(/\/$/, "");
    if (!trimmed) return "";
    try {
        const parsed = new URL(trimmed);
        if (!["http:", "https:"].includes(parsed.protocol)) return "";
        return parsed.toString().replace(/\/$/, "");
    } catch {
        return "";
    }
}
