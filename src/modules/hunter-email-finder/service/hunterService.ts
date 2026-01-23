
import { logger } from "@/lib/logger";
import { fetchWithBackoff } from "@/lib/api-resilience";

export interface HunterResult {
    email: string | null;
    score: number | null;
    position: string | null;
    company: string | null;
    sources: string[];
}

export class HunterService {
    /**
     * Find email for a person at a company
     * Uses Hunter.io API if key is present, otherwise falls back to safe heuristics or null
     */
    static async findEmail(fullName: string, company_domain: string): Promise<HunterResult> {
        const apiKey = process.env['HUNTER_API_KEY'];

        if (!apiKey) {
            logger.warn("[HunterService] No API key found. Returning empty result.");
            return { email: null, score: 0, position: null, company: null, sources: [] };
        }

        try {
            const firstName = fullName.split(" ")[0];
            const lastName = fullName.split(" ").slice(1).join(" ");

            const queryParams: Record<string, string> = {
                domain: company_domain,
                last_name: lastName,
                api_key: apiKey
            };
            if (firstName) queryParams['first_name'] = firstName;

            const params = new URLSearchParams(queryParams);

            const response = await fetchWithBackoff(`https://api.hunter.io/v2/email-finder?${params}`);
            const data = await response.json();

            if (data.data) {
                return {
                    email: data.data.email,
                    score: data.data.score,
                    position: data.data.position,
                    company: data.data.company,
                    sources: data.data.sources.map((s: any) => s.uri)
                };
            }

            return { email: null, score: 0, position: null, company: null, sources: [] };

        } catch (error) {
            logger.error("[HunterService] Failed to fetch email", error);
            throw new Error("Email finding service failed");
        }
    }

    /**
     * Legacy method for worker compatibility
     */
    async findAndStoreEmail(params: { firstName: string, lastName: string, domain: string, leadId: string }) {
        const result = await HunterService.findEmail(`${params.firstName} ${params.lastName}`, params.domain);
        // In a real app, strict storage logic might go here, but worker handles saving to DB.
        // We just return the interface expected by worker.
        return result;
    }

    /**
     * Legacy/Stub method for integration compatibility
     */
    async verifyAndUpdateEmail(email: string, _leadId?: string) {
        // Stub implementation
        return { email, status: 'unknown', score: 0 };
    }

    /**
     * Legacy/Stub method for integration compatibility
     */
    async bulkFindEmails(_leads: any[]) {
        return [];
    }
}

export const hunterService = new HunterService();
