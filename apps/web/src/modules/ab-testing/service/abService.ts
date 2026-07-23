class ABService {
    assignVariant(leadId: string): "A" | "B" {
        const hash = Array.from(leadId).reduce((acc, ch) => acc + ch.charCodeAt(0), 0);
        return hash % 2 === 0 ? "A" : "B";
    }

    async trackConversion(variant: "A" | "B", type: "open" | "click" | "reply", leadId?: string) {
        const res = await fetch((process.env["NEXT_PUBLIC_API_URL"] || "/api/proxy") + "/ab-testing/track", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ variant, type, leadId })
        });
        if (!res.ok) {
            const data = await res.json().catch(() => ({}));
            throw new Error(data.error || "Failed to track conversion");
        }
        return true;
    }

    async getStats() {
        const res = await fetch((process.env["NEXT_PUBLIC_API_URL"] || "/api/proxy") + "/ab-testing/track");
        if (!res.ok) {
            const data = await res.json().catch(() => ({}));
            throw new Error(data.error || "Failed to fetch A/B stats");
        }
        const data = await res.json();
        return data.stats;
    }
}

export const abService = new ABService();
