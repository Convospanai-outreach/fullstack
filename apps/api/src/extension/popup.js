    const logoutBtn = document.getElementById('logoutBtn');
    const teamSelect = document.getElementById('teamSelect');
    const capRatio = document.getElementById('capRatio');
    const capBar = document.getElementById('capBar');

    const { token, teamId, teamIds, apiBase } = await chrome.storage.local.get(["token", "teamId", "teamIds", "apiBase"]);
    const API_BASE = apiBase || "http://localhost:3000/api/proxy";

    if (token) {
        tokenInput.value = token;
        renderTeams(teamIds || [], teamId);
        showActions();
        fetchCaps();
    }

    saveBtn.addEventListener('click', async () => {
        const val = tokenInput.value.trim();
        if (!val) {
            setStatus("Please enter a token or user ID", "error");
            return;
        }

        setStatus("Validating...", "");
        
        try {
            const res = await fetch(`${API_BASE}/extension/auth/validate`, {
                method: "GET",
                headers: {
                    "Content-Type": "application/json",
                    "x-extension-key": "convo-ext-key-dev",
                    "Authorization": `Bearer ${val}`
                }
            });

            const data = await res.json();
            if (res.ok && data.valid) {
                 const tIds = data.teamIds || [];
                 const tId = tIds.length > 0 ? tIds[0] : null;
                 
                 await chrome.storage.local.set({ token: val, teamId: tId, teamIds: tIds });
                 chrome.runtime.sendMessage({ type: "UPDATE_STATE", token: val, teamId: tId });

                 renderTeams(tIds, tId);
                 setStatus("Connected!", "success");
                 showActions();
                 fetchCaps();
            } else {
                 setStatus(data.error || "Validation failed", "error");
            }
        } catch (e) {
            setStatus("Network error verifying token", "error");
        }
    });

    logoutBtn.addEventListener('click', async () => {
        await chrome.storage.local.remove(["token", "teamId", "teamIds"]);
        chrome.runtime.sendMessage({ type: "LOGOUT" });
        location.reload();
    });

    teamSelect.addEventListener('change', async (e) => {
        const newTeamId = e.target.value;
        await chrome.storage.local.set({ teamId: newTeamId });
        chrome.runtime.sendMessage({ type: "UPDATE_STATE", teamId: newTeamId });
        fetchCaps();
    });

    async function fetchCaps() {
        const { token, teamId } = await chrome.storage.local.get(["token", "teamId"]);
        if (!token || !teamId) return;

        try {
            // Proxy through the same endpoint used by validate? 
            // Or create a new one. For now, we'll try calling the MCP proxy if available
            const res = await fetch(`${API_BASE}/mcp/call`, {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    "x-extension-key": "convo-ext-key-dev",
                    "Authorization": `Bearer ${token}`
                },
                body: JSON.stringify({
                    server: "linkedin",
                    tool: "get_linkedin_daily_cap",
                    arguments: { teamId }
                })
            });

            if (res.ok) {
                const data = await res.json();
                const { used, limit } = data;
                capRatio.textContent = `${used} / ${limit}`;
                const pct = Math.min(100, (used / limit) * 100);
                capBar.style.width = `${pct}%`;
                if (pct >= 90) capBar.style.background = "#ef4444";
            }
        } catch (e) {
            console.error("Failed to fetch caps", e);
        }
    }

    function renderTeams(ids, selectedId) {
        teamSelect.innerHTML = "";
        ids.forEach(id => {
            const opt = document.createElement('option');
            opt.value = id;
            opt.textContent = `Team: ${id.substring(0, 8)}...`;
            if (id === selectedId) opt.selected = true;
            teamSelect.appendChild(opt);
        });
    }

    scrapeBtn.addEventListener('click', () => {
        chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
            if (tabs.length === 0) return;
            if (!tabs[0].url.includes("linkedin.com")) {
                setStatus("Must be on LinkedIn to scrape.", "error");
                return;
            }
            chrome.tabs.sendMessage(tabs[0].id, { type: "SCRAPE_MANUAL" }, (res) => {
                if (chrome.runtime.lastError) {
                    setStatus("Please refresh the page first.", "error");
                } else {
                    setStatus("Scrape initiated.", "success");
                }
            });
        });
    });

    likeBtn.addEventListener('click', () => {
         chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
            if (tabs.length === 0) return;
            chrome.tabs.sendMessage(tabs[0].id, { type: "LIKE_MANUAL" }, (res) => {
                if (chrome.runtime.lastError) {
                    setStatus("Please refresh the page first.", "error");
                } else {
                    setStatus("Like initiated.", "success");
                }
            });
        });
    });

    function setStatus(msg, type) {
        statusMsg.textContent = msg;
        statusMsg.className = `status ${type}`;
    }

    function showActions() {
        loginSection.style.display = 'none';
        actionsSection.style.display = 'block';
    }
});
