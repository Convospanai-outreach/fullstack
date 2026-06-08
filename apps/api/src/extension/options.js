const apiBaseInput = document.getElementById("apiBaseInput");
const tokenInput = document.getElementById("tokenInput");
const extensionKeyInput = document.getElementById("extensionKeyInput");
const teamIdInput = document.getElementById("teamIdInput");
const pollSecondsInput = document.getElementById("pollSecondsInput");
const pausedInput = document.getElementById("pausedInput");
const saveOptions = document.getElementById("saveOptions");
const status = document.getElementById("status");

loadOptions();

saveOptions.addEventListener("click", async () => {
  const settings = {
    apiBase: cmfNormalizeApiBase(apiBaseInput.value.trim()),
    token: tokenInput.value.trim(),
    extensionKey: extensionKeyInput.value.trim(),
    teamId: teamIdInput.value.trim(),
    pollSeconds: Math.max(15, Number(pollSecondsInput.value || 30))
  };

  await chrome.runtime.sendMessage({ type: "UPDATE_SETTINGS", settings });
  await chrome.runtime.sendMessage({ type: "TOGGLE_PAUSE", paused: pausedInput.checked });
  status.textContent = "Settings saved.";
});

async function loadOptions() {
  const state = await chrome.runtime.sendMessage({ type: "GET_STATE" });
  apiBaseInput.value = state.apiBase || "http://localhost:3000/api";
  tokenInput.value = state.token || "";
  extensionKeyInput.value = state.extensionKey || "";
  teamIdInput.value = state.teamId || "";
  pollSecondsInput.value = state.pollSeconds || 30;
  pausedInput.checked = Boolean(state.paused);
}
