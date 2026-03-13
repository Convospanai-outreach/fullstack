
const API_URL = process.env['NEXT_PUBLIC_API_URL'] || '';

export const knowledgeService = {
    async createKnowledgeBase(teamId: string, name: string, description?: string) {
        const res = await fetch(`${API_URL}/knowledge/base`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ teamId, name, description })
        });
        return await res.json();
    },

    async listKnowledgeBases(teamId: string) {
        const res = await fetch(`${API_URL}/knowledge/list?teamId=${teamId}`);
        return await res.json();
    },

    async addDocument(knowledgeBaseId: string, content: string, metadata: any = {}) {
        const res = await fetch(`${API_URL}/knowledge/add`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ knowledgeBaseId, content, metadata })
        });
        return await res.json();
    },

    async search(knowledgeBaseId: string, query: string, limit = 5) {
        const res = await fetch(`${API_URL}/knowledge/search`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ knowledgeBaseId, query, limit })
        });
        return await res.json();
    },

    async deleteDocument(id: string) {
        const res = await fetch(`${API_URL}/knowledge/delete`, {
            method: "DELETE",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ id })
        });
        return await res.json();
    }
};
