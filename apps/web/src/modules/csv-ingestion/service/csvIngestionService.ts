import { getBrowserApiBase } from "@/lib/api/browserBase";
function getApiBaseUrl(): string {
    if (typeof window !== "undefined") {
        return "/api/proxy";
    }
    return (
        process.env['API_INTERNAL_ORIGIN'] ||
        getBrowserApiBase()
    );
}

export interface CSVRow {
    email: string;
    fullName?: string;
    company?: string;
    jobTitle?: string;
    linkedIn?: string;
    location?: string;
}

class CSVIngestionService {
    /**
     * Get AI-suggested mapping for CSV headers
     */
    async suggestMapping(headers: string[]) {
        try {
            const baseUrl = getApiBaseUrl();
            const res = await fetch(`${baseUrl}/import/suggest-mapping`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ headers })
            });
            if (!res.ok) return this.autoDetectFieldMapping(headers);
            return await res.json();
        } catch (error) {
            console.error("Mapping suggestion proxy failed:", error);
            return this.autoDetectFieldMapping(headers);
        }
    }

    /**
     * Simple client-side auto-detection fallback
     */
    autoDetectFieldMapping(headers: string[]): Record<string, string> {
        const mapping: Record<string, string> = {};
        headers.forEach(h => {
            const nh = h.toLowerCase().replace(/[\s_]+/g, '');
            if (nh.includes('email') || nh === 'mail') mapping[h] = 'email';
            else if (nh.includes('name') || nh === 'fullname' || nh === 'contactname') mapping[h] = 'fullName';
            else if (nh.includes('linkedin') || nh.includes('profile')) mapping[h] = 'linkedIn';
            else if (nh.includes('company') || nh === 'org') mapping[h] = 'company';
            else if (nh.includes('title') || nh.includes('role')) mapping[h] = 'jobTitle';
            else if (nh.includes('location') || nh.includes('city')) mapping[h] = 'location';
        });
        return mapping;
    }

    async processCSV(csvContent: string, teamId: string | null, mapping?: Record<string, string>) {
        try {
            const baseUrl = getApiBaseUrl();
            const res = await fetch(`${baseUrl}/leads/import`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ csvContent, teamId, mapping })
            });
            if (!res.ok) throw new Error(`CSV process failed with status ${res.status}`);
            return await res.json();
        } catch (error) {
            console.error("CSV process proxy failed:", error);
            return { success: false, message: "Server-side processing failed" };
        }
    }
}

export const csvIngestionService = new CSVIngestionService();
