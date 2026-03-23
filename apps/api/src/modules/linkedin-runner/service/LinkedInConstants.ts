export const LinkedInConstants = {
    SELECTORS: {
        CONNECT_BTN: [
            'button[aria-label*="Connect"]',
            'button:has-text("Connect")',
            '.artdeco-button[aria-label^="Connect"]'
        ],
        SEND_BTN: [
            'button[aria-label*="Send"]',
            'button:has-text("Send")',
            '.artdeco-button[aria-label^="Send now"]'
        ],
        ADD_NOTE_BTN: 'button[aria-label*="Add a note"]',
        NOTE_TEXTAREA: 'textarea[name="message"]',
        PROFILE_NAME: 'h1.text-heading-xlarge',
    }
};
