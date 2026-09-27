import { vectorStore } from "./vectorStore";
import { assertSafeWebhookUrl } from "@/modules/webhooks/service/webhookService";

const MAX_REDIRECTS = 3;
const MAX_BODY_BYTES = 5 * 1024 * 1024;
const FETCH_TIMEOUT_MS = 15000;
const REDIRECT_STATUSES = new Set([301, 302, 303, 307, 308]);

/**
 * Fetches a team-supplied URL for ingestion. Redirects are followed by hand so
 * the SSRF guard runs on every hop: fetch's automatic following would let a
 * 302 to 169.254.169.254 or an internal host through, and the body is stored
 * where the team can read it (OPEN-273). One timeout covers all hops and the
 * body read. Shares its guard with outbound webhooks (roadmap 3.5 / S-15),
 * which refuse redirects outright; both could move to one guarded-fetch helper.
 */
async function fetchPublicPage(rawUrl: string): Promise<string> {
    const signal = AbortSignal.timeout(FETCH_TIMEOUT_MS);
    let url = rawUrl;

    for (let hops = 0; ; hops++) {
        await assertSafeWebhookUrl(url);

        const response = await fetch(url, {
            headers: { "User-Agent": "CraftMyFunnel-Bot/1.0" },
            redirect: "manual",
            signal,
        });

        const location = response.headers.get("location");
        if (REDIRECT_STATUSES.has(response.status) && location) {
            await response.body?.cancel();
            if (hops >= MAX_REDIRECTS) throw new Error(`Too many redirects fetching ${rawUrl}`);
            url = new URL(location, url).href;
            continue;
        }

        if (!response.ok) {
            await response.body?.cancel();
            throw new Error(`HTTP ${response.status} fetching ${url}`);
        }

        if (Number(response.headers.get("content-length")) > MAX_BODY_BYTES) {
            await response.body?.cancel();
            throw new Error(`Response from ${url} exceeds ${MAX_BODY_BYTES} bytes`);
        }

        const chunks: Uint8Array[] = [];
        let total = 0;
        if (response.body) {
            const reader = response.body.getReader();
            for (;;) {
                const { done, value } = await reader.read();
                if (done) break;
                total += value.byteLength;
                if (total > MAX_BODY_BYTES) {
                    await reader.cancel();
                    throw new Error(`Response from ${url} exceeds ${MAX_BODY_BYTES} bytes`);
                }
                chunks.push(value);
            }
        }
        return Buffer.concat(chunks).toString("utf8");
    }
}

class IngestService {
    /**
     * Ingest a raw block of text
     */
    async ingestText(text: string, knowledgeBaseId: string, metadata?: any) {
        // Chunking with overlap: ~500 chars per chunk, 100 char overlap
        const chunkSize = 500;
        const overlap = 100;
        const chunks = [];

        for (let i = 0; i < text.length; i += (chunkSize - overlap)) {
            chunks.push(text.slice(i, i + chunkSize));
            if (i + chunkSize >= text.length) break;
        }

        const results = [];
        for (const chunk of chunks) {
            if (chunk.trim().length < 20) continue; // Skip very small fragments
            const doc = await vectorStore.addDocument(chunk, knowledgeBaseId, metadata);
            results.push(doc);
        }

        return results;
    }

    /**
     * Ingest content from a URL (Scraping)
     */
    async ingestUrl(url: string, knowledgeBaseId: string) {
        console.log(`[Ingest] Crawling: ${url}`);

        try {
            // Reuses the webhook module's SSRF guard: url is attacker-supplied (any
            // team member can submit it) and this fetch's response text is stored and
            // returned to that team, so it must not be usable as a probe against
            // internal infrastructure or cloud metadata endpoints. fetchPublicPage
            // re-runs the guard on every redirect hop.
            const html = await fetchPublicPage(url);
            
            // Simple extraction: strip scripts, styles, and tags
            const text = html
                .replace(/<script\b[^>]*>([\s\S]*?)<\/script>/gm, "")
                .replace(/<style\b[^>]*>([\s\S]*?)<\/style>/gm, "")
                .replace(/<[^>]+>/g, " ")
                .replace(/\s+/g, " ")
                .trim();

            if (text.length < 100) {
                throw new Error("Extracted text is too short or empty.");
            }

            return await this.ingestText(text, knowledgeBaseId, { source: url, type: "URL" });
        } catch (error: any) {
            console.error(`[Ingest] Crawl failed for ${url}: ${error.message}`);
            // Fallback for demo continuity if network is isolated, but marked as failed
            throw error;
        }
    }

    /**
     * Ingest a file (PDF/Doc)
     */
    async ingestDocument(fileName: string, content: string, knowledgeBaseId: string) {
        console.log(`[Ingest] Processing document: ${fileName}`);

        return await this.ingestText(content, knowledgeBaseId, {
            source: fileName,
            type: fileName.toLowerCase().endsWith('.pdf') ? "PDF" : "DOC"
        });
    }
}

export const ingestService = new IngestService();
