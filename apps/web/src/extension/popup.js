document.addEventListener("DOMContentLoaded", () => {
    const apiUrlInput = document.getElementById("apiUrlInput");
    const keyInput = document.getElementById("keyInput");
    const tokenInput = document.getElementById("tokenInput");
    const saveTokenBtn = document.getElementById("saveToken");
    const loginSection = document.getElementById("loginSection");
    const actionsSection = document.getElementById("actionsSection");
    const statusMsg = document.getElementById("statusMsg");

    function showActions() {
        loginSection.style.display = "none";
        actionsSection.style.display = "block";
    }

    function showStatus(msg, type = "info") {
        statusMsg.innerText = msg;
        statusMsg.className = "status";
        if (type === "success") statusMsg.classList.add("success");
        if (type === "error") statusMsg.classList.add("error");

        setTimeout(() => {
            statusMsg.innerText = "Ready";
            statusMsg.className = "status";
        }, 3000);
    }

    function validateConnection() {
        chrome.runtime.sendMessage({ type: "VALIDATE_AUTH" }, (response) => {
            if (response?.ok) {
                showActions();
                showStatus("Connected and validated", "success");
            } else {
                showStatus(response?.error || response?.data?.error || "Validation failed", "error");
            }
        });
    }

    chrome.runtime.sendMessage({ type: "GET_CONFIG" }, (response) => {
        if (!response) return;
        apiUrlInput.value = response.apiUrl || "http://localhost:3000/api/proxy/extension";
        keyInput.value = response.extensionKey || "";
        tokenInput.value = response.token || "";

        if (response.token && response.extensionKey) {
            validateConnection();
        }
    });

    saveTokenBtn.onclick = () => {
        const token = tokenInput.value.trim();
        const extensionKey = keyInput.value.trim();
        const apiUrl = apiUrlInput.value.trim() || "http://localhost:3000/api/proxy/extension";

        if (!token) {
            showStatus("Enter token (user id or session token)", "error");
            return;
        }
        if (!extensionKey) {
            showStatus("Enter extension key", "error");
            return;
        }

        chrome.runtime.sendMessage({ type: "SET_CONFIG", token, extensionKey, apiUrl }, (response) => {
            if (response?.ok) {
                validateConnection();
            } else {
                showStatus("Failed to save configuration", "error");
            }
        });
    };

    document.getElementById("scrapeProfile").onclick = () => {
        showStatus("Scraping...");
        chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
            if (!tabs[0]?.url?.includes("linkedin.com")) {
                showStatus("Not a LinkedIn page", "error");
                return;
            }
            chrome.tabs.sendMessage(tabs[0].id, { type: "SCRAPE_NOW" }, (profile) => {
                if (chrome.runtime.lastError) {
                    showStatus("Error connecting to page. Reload page?", "error");
                    return;
                }
                if (profile) {
                    chrome.runtime.sendMessage({ type: "SCRAPE_PROFILE", data: profile }, (res) => {
                        if (res && res.ok) {
                            showStatus("Profile saved to dashboard", "success");
                        } else {
                            showStatus("Failed to save: " + (res?.error || "Unknown"), "error");
                        }
                    });
                } else {
                    showStatus("Failed to scrape", "error");
                }
            });
        });
    };

    document.getElementById("likePost").onclick = () => {
        showStatus("Liking...");
        chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
            if (!tabs[0]?.url?.includes("linkedin.com")) {
                showStatus("Not a LinkedIn page", "error");
                return;
            }
            chrome.tabs.sendMessage(tabs[0].id, { type: "LIKE_POST" }, (res) => {
                if (res && res.ok) {
                    chrome.runtime.sendMessage({
                        type: "EXTENSION_ACTION",
                        data: {
                            action: "LIKE_POST",
                            profileUrl: tabs[0].url,
                            success: true
                        }
                    }, () => showStatus("Post liked and logged", "success"));
                } else {
                    showStatus("Failed to like: " + (res?.error || "Unknown"), "error");
                }
            });
        });
    };
});
