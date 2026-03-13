
const API_URL = process.env['NEXT_PUBLIC_API_URL'] || '';

class AIService {
    async getEmbeddings(text: string) {
        try {
            const res = await fetch(`${API_URL}/ai/embeddings`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ text })
            });
            if (!res.ok) throw new Error("API failure");
            return await res.json();
        } catch (e) {
            console.error("Embedding proxy failed:", e);
            return new Array(768).fill(0); // Mock fallback
        }
    }

    async generateEmailDraft(lead: any, icp: any, teamId?: string) {
        try {
            const res = await fetch(`${API_URL}/ai/generate-email`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ lead, icp, teamId })
            });
            if (!res.ok) throw new Error("API failure");
            return await res.json();
        } catch (e) {
            console.error("Email draft proxy failed:", e);
            return {
                subject: `Personalized Outreach for ${lead.company}`,
                body: `Hi ${lead.firstName},\n\nI'd love to chat about how we can help ${lead.company}.`
            };
        }
    }

    async researchCompany(companyName: string) {
        try {
            const res = await fetch(`${API_URL}/ai/research-company`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ companyName })
            });
            if (!res.ok) throw new Error("API failure");
            return await res.json();
        } catch (e) {
            console.error("Company research proxy failed:", e);
            return {
                summary: `Research for ${companyName} unavailable.`,
                industry: "Unknown",
                employees: "N/A",
                revenue: "N/A"
            };
        }
    }
}

export const aiService = new AIService();
