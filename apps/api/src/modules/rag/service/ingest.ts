import { vectorStore } from "./vectorStore";

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
            const response = await fetch(url, { headers: { "User-Agent": "CraftMyFunnel-Bot/1.0" } });
            if (!response.ok) throw new Error(`HTTP ${response.status} fetching ${url}`);
            
            const html = await response.text();
            
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
