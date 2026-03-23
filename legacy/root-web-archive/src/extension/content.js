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
                    error: result.error
                }
            });
        });
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
        window.location.href = task.payload.url;
        // The script will reload on new page, background needs to re-send task? 
        // Simple/Naive: return, let background retry or rely on 'tabs.onUpdated' in background to re-inject.
        // For V2, we assume user might be on the page or we just return "Loading page" status.
        return { success: false, error: "Navigating to target URL..." };
    }

    try {
        if (task.type === "VIEW_PROFILE") {
            await waitFor(".pv-text-details__left-panel h1");
            const data = scrapeProfileData();
            return { success: true, data };
        }

        if (task.type === "LIKE_POST") {
            const likeBtn = await waitFor("button[aria-label*='Like']");
            if (likeBtn) {
                likeBtn.click();
                return { success: true };
            } else {
                return { success: false, error: "Like button not found" };
            }
        }

        return { success: false, error: "Unknown task type" };
    } catch (e) {
        return { success: false, error: e.message };
    }
}
