document.addEventListener('DOMContentLoaded', () => {
    const tokenInput = document.getElementById("tokenInput");
    const saveTokenBtn = document.getElementById("saveToken");
    const loginSection = document.getElementById("loginSection");
    const actionsSection = document.getElementById("actionsSection");
    const statusMsg = document.getElementById("statusMsg");

    // Check for existing token
    chrome.runtime.sendMessage({ type: "GET_TOKEN" }, (response) => {
        if (response && response.token) {
            showActions();
        }
    });

    function showActions() {
        loginSection.style.display = "none";
        actionsSection.style.display = "block";
    }

    function showStatus(msg, type = 'info') {
        statusMsg.innerText = msg;
        statusMsg.className = 'status'; // Reset
        if (type === 'success') statusMsg.classList.add('success');
        if (type === 'error') statusMsg.classList.add('error');

        setTimeout(() => {
            statusMsg.innerText = "Ready to deploy";
            statusMsg.className = 'status';
        }, 3000);
    }

    saveTokenBtn.onclick = () => {
        let token = tokenInput.value.trim();
        if (!token) {
            showStatus("Please enter a token", "error");
            return;
        }
        chrome.runtime.sendMessage({ type: "SET_TOKEN", token }, (response) => {
            if (response && response.ok) {
                showActions();
                showStatus("Token saved!", "success");
            }
        });
    };

    document.getElementById("scrapeProfile").onclick = () => {
        showStatus("Scraping...");
        chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
            if (!tabs[0].url.includes("linkedin.com")) {
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
                            showStatus("Profile saved to Dashboard!", "success");
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
            if (!tabs[0].url.includes("linkedin.com")) {
                showStatus("Not a LinkedIn page", "error");
                return;
            }
            chrome.tabs.sendMessage(tabs[0].id, { type: "LIKE_POST" }, (res) => {
                if (res && res.ok) {
                    // Notify backend
                    chrome.runtime.sendMessage({
                        type: "EXEC_ACTION",
                        data: { action: "LIKE", url: tabs[0].url, status: "SUCCESS" }
                    }, (backendRes) => {
                        showStatus("Post Liked & Logged!", "success");
                    });
                } else {
                    showStatus("Failed to like: " + (res?.error || "Unknown"), "error");
                }
            });
        });
    };
});
