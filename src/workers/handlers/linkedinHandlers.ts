import { runLinkedInAction } from "@/linkedin/puppeteerRunner";
import { JobPayload } from "@/lib/queue";

export async function handleLikePost(payload: JobPayload) {
    if (!payload.url) throw new Error("URL is required for LIKE_POST");

    return await runLinkedInAction({
        type: "LIKE",
        url: payload['url'] || ""
    });
}

export async function handleCommentPost(payload: JobPayload) {
    if (!payload.url) throw new Error("URL is required for COMMENT_POST");
    if (!payload.text) throw new Error("Text is required for COMMENT_POST");

    return await runLinkedInAction({
        type: "COMMENT",
        url: payload['url'] || "",
        message: payload['text'] || ""
    });
}

export async function handleScrapeProfile(payload: JobPayload) {
    if (!payload.url) throw new Error("URL is required for SCRAPE_PROFILE");

    return await runLinkedInAction({
        type: "SCRAPE",
        url: payload['url'] || ""
    });
}
