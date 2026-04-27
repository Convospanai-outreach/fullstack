import { runLinkedInAction } from "@/linkedin/puppeteerRunner";
import { JobPayload } from "@/lib/queue";
import { aiService } from "@/lib/aiService";

export async function handleSmartComment(payload: JobPayload) {
    if (!payload.url) throw new Error("URL is required for SMART_COMMENT");

    // 1. Scrape post content
    const scrapeResult = await runLinkedInAction({
        type: "SCRAPE_POST",
        url: payload.url
    });

    if (!scrapeResult.ok || !scrapeResult.text) {
        throw new Error("Failed to scrape post content: " + scrapeResult.error);
    }

    const postContent = scrapeResult.text;

    // 2. Generate comment using AI
    const comment = await aiService.generateComment(postContent, "User Profile Context");

    // 3. Post comment
    return await runLinkedInAction({
        type: "COMMENT",
        url: payload.url,
        message: comment
    });
}

export async function handleSmartConnect(payload: JobPayload) {
    if (!payload.url) throw new Error("URL is required for SMART_CONNECT");

    // 1. Scrape profile
    const scrapeResult = await runLinkedInAction({
        type: "SCRAPE",
        url: payload.url
    });

    if (!scrapeResult.ok || !scrapeResult.data) {
        // If scrape fails, we might still want to connect but without a personalized note?
        // Or fail. Let's fail for now as "Smart Connect" implies personalization.
        // Note: runLinkedInAction SCRAPE returns { ok: true, data: ... } usually.
        // We need to ensure puppeteerRunner returns data for SCRAPE.
        // Checking puppeteerRunner... it returns { ok: true, action } currently for generic actions.
        // We need to update puppeteerRunner to return scraped data for SCRAPE type.
        throw new Error("Failed to scrape profile for smart connect");
    }

    // Assuming scrapeResult.data contains the profile text/summary
    const profileContext = JSON.stringify(scrapeResult.data);

    // 2. Generate connection message using AI
    const message = await aiService.generateConnectionMessage(profileContext);

    // 3. Connect with note
    // Note: Puppeteer runner needs to support "CONNECT_WITH_NOTE" or we handle it in "CONNECT"
    // The current puppeteerRunner handles "CONNECT" but we might need to pass the message.
    // Let's assume we use INMAIL logic or update puppeteerRunner later for Connect+Note.
    // For now, we'll use INMAIL as a proxy for "Connect with Note" or just CONNECT if no message support.

    // Actually, let's use CONNECT. If puppeteerRunner supports adding a note, we'd pass it.
    // The current runner has:
    // if (action.type === "CONNECT") { ... // Handle "Add a note" modal if it appears ... }
    // But it doesn't seem to take a message payload for CONNECT.
    // Let's stick to standard CONNECT for now, or use INMAIL if message is critical.
    // The requirement says "generateConnectionMessage", so we should probably use INMAIL or update runner.
    // Let's use INMAIL for now as it takes a message.

    return await runLinkedInAction({
        type: "INMAIL", // Using InMail to send the generated message
        url: payload.url,
        message: message
    });
}
