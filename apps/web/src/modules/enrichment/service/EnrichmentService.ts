
const API_URL = (process.env['NEXT_PUBLIC_API_URL'] || "/api/proxy");

export class EnrichmentService {
    static async enrichLead(leadId: string) {
        try {
            const res = await fetch(`${API_URL}/enrichment/lead`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ leadId })
            });
            if (!res.ok) throw new Error("Enrichment proxy failure");
            return await res.json();
        } catch (error) {
            console.error("[EnrichmentService] Enrichment proxy failed:", error);
            throw error;
        }
    }
}
