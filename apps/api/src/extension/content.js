// content.js - Injected into LinkedIn pages

function scrapeProfile() {
    if (!window.location.href.includes("/in/")) {
        return null;
    }
    const nameEl = document.querySelector('h1.text-heading-xlarge');
    const headlineEl = document.querySelector('div.text-body-medium');
    const locationEl = document.querySelector('span.text-body-small.inline.t-black--light.break-words');
    const aboutEl = document.querySelector('div#about ~ div .display-flex .visually-hidden'); // Generic about

    const name = nameEl ? nameEl.innerText.trim() : "";
    const headline = headlineEl ? headlineEl.innerText.trim() : "";
    const location = locationEl ? locationEl.innerText.trim() : "";
    
    // About extraction can be tricky on LinkedIn, a fallback or generalized query
    let about = "";
    const aboutBox = Array.from(document.querySelectorAll('section')).find(s => s.innerText.includes('About'));
    if (aboutBox) {
        const span = aboutBox.querySelector('.display-flex span[aria-hidden="true"]');
        if (span) about = span.innerText.trim();
    }

    const data = {
        name,
        headline,
        location,
        about,
        url: window.location.href.split('?')[0]
    };

    chrome.runtime.sendMessage({ type: "PROFILE_DATA", data });
    return data;
}

function detectWarnings() {
    const text = document.body.innerText.toLowerCase();
    
    if (text.includes("we noticed unusual activity") || text.includes("verify your identity") || document.querySelector('#captcha-internal')) {
        return "VERIFICATION_REQUIRED";
    }
    if (text.includes("you've reached the weekly invitation limit") || text.includes("out of invitations for the week")) {
        return "INVITE_LIMIT_REACHED";
    }
    if (text.includes("limit on how many searches") || text.includes("commercial use limit")) {
        return "WARNING_DETECTED";
    }
    return null;
}

async function handleTask(task) {
    const startTime = Date.now();
    let status = "ERROR";
    let stopReason = detectWarnings();
    let error = null;
    const payload = task.payload || {};

    if (stopReason) {
        return reportResult({ taskId: task.id, action: task.type, status: "BLOCKED", stopReason, durationMs: Date.now() - startTime });
    }

    try {
        if (task.type === "VIEW_PROFILE" || task.type === "VIEW") {
            scrapeProfile();
            status = "SUCCESS";
        } else if (task.type === "LIKE_POST" || task.type === "LIKE") {
            const likeBtn = document.querySelector('button.react-button__trigger, button[aria-label="React Like"]');
            if (likeBtn) {
                if (likeBtn.getAttribute('aria-pressed') !== 'true') {
                    likeBtn.click();
                }
                status = "SUCCESS";
            } else {
                error = "Like button not found";
            }
        } else if (task.type === "CONNECT") {
            const connectBtn = Array.from(document.querySelectorAll('button')).find(b => 
                b.innerText.includes('Connect') && !b.innerText.includes('Message')
            );
            if (connectBtn) {
                connectBtn.click();
                await new Promise(r => setTimeout(r, 1000));
                
                if (payload.personalizedNote) {
                    const addNoteBtn = Array.from(document.querySelectorAll('button')).find(b => b.innerText.includes('Add a note'));
                    if (addNoteBtn) {
                        addNoteBtn.click();
                        await new Promise(r => setTimeout(r, 500));
                        
                        const textArea = document.querySelector('textarea[name="message"]');
                        if (textArea) {
                            textArea.value = payload.personalizedNote;
                            textArea.dispatchEvent(new Event('input', { bubbles: true }));
                        }
                    }
                }

                const sendBtn = Array.from(document.querySelectorAll('button')).find(b => 
                    b.innerText === 'Send' || b.innerText === 'Send without a note'
                );
                
                if (sendBtn) {
                    sendBtn.click();
                    status = "SUCCESS";
                } else {
                    error = "Send button not found";
                }
            } else {
                error = "Connect button not found (Already connected or hidden)";
            }
        } else if (task.type === "SEND_INMAIL" || task.type === "MESSAGE") {
            const msgBtn = Array.from(document.querySelectorAll('button')).find(b => 
                b.innerText.includes('Message') || b.getAttribute('aria-label')?.includes('Message')
            );
            if (msgBtn) {
                msgBtn.click();
                await new Promise(r => setTimeout(r, 1500));
                
                // LinkedIn InMail Composer
                const subjectInput = document.querySelector('.msg-form__subject');
                const bodyInput = document.querySelector('.msg-form__contenteditable[contenteditable="true"]');
                
                if (bodyInput) {
                    if (subjectInput && payload.subject) {
                        subjectInput.value = payload.subject;
                        subjectInput.dispatchEvent(new Event('input', { bubbles: true }));
                    }
                    
                    bodyInput.innerHTML = `<p>${payload.personalizedNote || payload.body || ""}</p>`;
                    bodyInput.dispatchEvent(new Event('input', { bubbles: true }));
                    
                    await new Promise(r => setTimeout(r, 500));
                    const sendBtn = document.querySelector('.msg-form__send-button');
                    if (sendBtn && !sendBtn.disabled) {
                        sendBtn.click();
                        status = "SUCCESS";
                    } else {
                        error = "InMail send button disabled or not found";
                    }
                } else {
                    error = "InMail composer not found";
                }
            } else {
                error = "InMail button not found";
            }
        } else {
            error = "Unknown task type: " + task.type;
        }
    } catch (e) {
        error = e.message;
    }

    reportResult({
        taskId: task.id,
        action: task.type,
        status,
        error,
        profileUrl: window.location.href.split('?')[0],
        durationMs: Date.now() - startTime
    });
}

function reportResult(result) {
    chrome.runtime.sendMessage({ type: "ACTION_RESULT", result });
}

// Listen for tasks from background
chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
    if (msg.type === "EXECUTE_TASK") {
        handleTask(msg.task).then(() => sendResponse({ ok: true }));
        return true;
    } else if (msg.type === "SCRAPE_MANUAL") {
        scrapeProfile();
        sendResponse({ ok: true });
    } else if (msg.type === "LIKE_MANUAL") {
        handleTask({ id: "manual", type: "LIKE_POST" });
        sendResponse({ ok: true });
    }
});

// Navigation intercept hack for SPA
let lastUrl = location.href; 
new MutationObserver(() => {
  const url = location.href;
  if (url !== lastUrl) {
    lastUrl = url;
    chrome.runtime.sendMessage({ type: "NAVIGATE_PENDING", url });
  }
}).observe(document, {subtree: true, childList: true});
