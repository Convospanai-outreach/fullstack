function scrapeProfileData() {
    const name = document.querySelector(".pv-text-details__left-panel h1")?.innerText?.trim();
    const headline = document.querySelector(".pv-text-details__left-panel .text-body-medium")?.innerText?.trim();
    const about = document.querySelector(".inline-show-more-text")?.innerText?.trim();
    const location = document.querySelector(".pv-text-details__left-panel .text-body-small")?.innerText?.trim();

    return { name, headline, about, location, url: window.location.href };
}

// Helper to wait for element
const waitFor = (selector, timeout = 3000) => {
    return new Promise((resolve) => {
        if (document.querySelector(selector)) return resolve(document.querySelector(selector));

        const observer = new MutationObserver((mutations) => {
            if (document.querySelector(selector)) {
                observer.disconnect();
                resolve(document.querySelector(selector));
            }
        });

        observer.observe(document.body, { childList: true, subtree: true });

        setTimeout(() => {
            observer.disconnect();
            resolve(null);
        }, timeout);
    });
};

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

function findButtonByText(text) {
    const buttons = Array.from(document.querySelectorAll("button, div[role='button']"));
    const lowered = text.toLowerCase();
    return buttons.find((el) => (el.innerText || "").trim().toLowerCase().includes(lowered)) || null;
}

async function performLike() {
    const likeBtn = await waitFor("button[aria-label*='Like'], button[aria-label*='like']");
    if (!likeBtn) {
        return { success: false, error: "Like button not found" };
    }
    likeBtn.click();
    return { success: true };
}

async function performConnect(taskPayload = {}) {
    const directButton =
        document.querySelector("button[aria-label*='Invite']") ||
        document.querySelector("button[aria-label*='Connect']") ||
        findButtonByText("Connect");

    if (!directButton) {
        return { success: false, error: "Connect button not found" };
    }

    directButton.click();
    await sleep(600);

    // LinkedIn modal variants: Send / Send now.
    const sendButton =
        document.querySelector("button[aria-label*='Send']") ||
        findButtonByText("Send");

    if (sendButton) {
        sendButton.click();
        return { success: true, data: { action: "CONNECT_SENT" } };
    }

    // Some variants open a chooser; mark as partial success for operator follow-up.
    return {
        success: true,
        data: {
            action: "CONNECT_CLICKED",
            note: taskPayload?.message ? "Message provided; manual final send may be required." : "Connect dialog opened."
        }
    };
}

chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
    console.log("Context Script received:", msg);

    if (msg.type === "EXECUTE_TASK") {
        const task = msg.task;
        handleTask(task).then(result => {
            // Send completion back to background
            chrome.runtime.sendMessage({
                type: "TASK_COMPLETE",
                data: {
                    taskId: task.id,
                    success: result.success,
                    result: result.data,
                    error: result.error,
                    pending: result.pending,
                    navigateTo: result.navigateTo
                }
            });
            sendResponse(result);
        });
        return true;
    }

    if (msg.type === "LIKE_POST") {
        performLike().then((result) => sendResponse({ ok: result.success, ...result }));
        return true;
    }

    // Legacy manual triggers
    if (msg.type === "SCRAPE_NOW") {
        const profile = scrapeProfileData();
        sendResponse(profile);
    }

    // ... keep existing manual handlers if needed ...

    return true;
});

async function handleTask(task) {
    // 1. Navigation Check
    if (task.payload?.url && window.location.href !== task.payload.url) {
        return {
            success: false,
            pending: true,
            navigateTo: task.payload.url,
            error: "Navigating to target URL"
        };
    }

    try {
        if (task.type === "VIEW_PROFILE") {
            await waitFor(".pv-text-details__left-panel h1");
            const data = scrapeProfileData();
            return { success: true, data };
        }

        if (task.type === "LIKE_POST") {
            return await performLike();
        }

        if (task.type === "CONNECT") {
            return await performConnect(task.payload || {});
        }

        return { success: false, error: "Unknown task type" };
    } catch (e) {
        return { success: false, error: e.message };
    }
}
