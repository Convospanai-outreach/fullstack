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
        console.log(`[Ingest] Extracting content from: ${url}`);

        // In a real environment, use Puppeteer or a scraping service
        // For this implementation, we'll simulate the extraction
        const simulatedText = `Content from ${url}: This document explains the core principles of ${url.split('/')[2] || 'the target site'}. It covers pricing, features, and implementation details necessary for sales outreach.`;

        return await this.ingestText(simulatedText, knowledgeBaseId, { source: url, type: "URL" });
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
