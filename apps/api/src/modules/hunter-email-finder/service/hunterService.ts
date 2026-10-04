
import { logger } from "@/lib/logger";
import { fetchWithBackoff } from "@/lib/api-resilience";

export interface HunterResult {
    email: string | null;
    score: number | null;
    position: string | null;
    company: string | null;
    sources: string[];
    firstName?: string | null;
    lastName?: string | null;
    domain?: string | null;
    phoneNumber?: string | null;
}

// Hunter's Email Finder needs a domain, a company name or a LinkedIn handle, plus a name
// unless the handle is given.
export interface HunterFindQuery {
    fullName?: string;
    domain?: string;
    company?: string;
    linkedinHandle?: string;
}

export class HunterService {
    /**
     * Find email for a person at a company
     * Uses Hunter.io API if key is present, otherwise falls back to safe heuristics or null
     */
    static async findEmail(fullName: string, company_domain: string): Promise<HunterResult> {
        return HunterService.find({ fullName, domain: company_domain });
    }

    static async find(query: HunterFindQuery): Promise<HunterResult> {
        const apiKey = process.env['HUNTER_API_KEY'];

        if (!apiKey) {
            logger.warn("[HunterService] No API key found. Returning empty result.");
            return { email: null, score: 0, position: null, company: null, sources: [] };
        }

        try {
            const fullName = (query.fullName || "").trim();
            const firstName = fullName.split(" ")[0];
            const lastName = fullName.split(" ").slice(1).join(" ");

            const queryParams: Record<string, string> = { api_key: apiKey };
            if (query.linkedinHandle) queryParams['linkedin_handle'] = query.linkedinHandle;
            if (query.domain) queryParams['domain'] = query.domain;
            else if (query.company) queryParams['company'] = query.company;
            if (lastName) queryParams['last_name'] = lastName;
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
                    sources: (data.data.sources || []).map((s: any) => s.uri),
                    firstName: data.data.first_name ?? null,
                    lastName: data.data.last_name ?? null,
                    domain: data.data.domain ?? null,
                    phoneNumber: data.data.phone_number ?? null
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
    async findAndStoreEmail(params: { firstName: string, lastName: string, domain?: string, company?: string, linkedinHandle?: string, leadId: string }) {
        const result = await HunterService.find({
            fullName: `${params.firstName} ${params.lastName}`,
            domain: params.domain,
            company: params.company,
            linkedinHandle: params.linkedinHandle,
        });
        // In a real app, strict storage logic might go here, but worker handles saving to DB.
        // We just return the interface expected by worker.
        return result;
    }

    /**
     * Verifies an email address using Hunter.io Email Verifier API
     */
    async verifyAndUpdateEmail(email: string, _leadId?: string) {
        const apiKey = process.env['HUNTER_API_KEY'];

        if (!apiKey) {
            logger.warn("[HunterService] No API key for verification. Returning unknown.");
            return { email, status: 'unknown', score: 0 };
        }

        try {
            const params = new URLSearchParams({ email, api_key: apiKey });
            const response = await fetchWithBackoff(`https://api.hunter.io/v2/email-verifier?${params}`);
            const data = await response.json();

            if (data.data) {
                return {
                    email: data.data.email,
                    status: data.data.status, // 'valid', 'invalid', 'accept_all', 'unknown'
                    score: data.data.score
                };
            }
            return { email, status: 'unknown', score: 0 };
        } catch (error) {
            logger.error("[HunterService] Verification failed", error);
            return { email, status: 'error', score: 0 };
        }
    }

    /**
     * Finds emails for multiple leads in bulk using sequential calls
     */
    async bulkFindEmails(leads: Array<{ fullName: string; domain: string; leadId?: string }>) {
        const results: Array<{ leadId?: string; result: HunterResult }> = [];

        for (const lead of leads) {
            try {
                const result = await HunterService.findEmail(lead.fullName, lead.domain);
                const entry: { leadId?: string; result: HunterResult } = { result };
                if (lead.leadId !== undefined) entry.leadId = lead.leadId;
                results.push(entry);
            } catch (error) {
                logger.warn(`[HunterService] Bulk find failed for ${lead.fullName}`, error);
                const entry: { leadId?: string; result: HunterResult } = {
                    result: { email: null, score: 0, position: null, company: null, sources: [] }
                };
                if (lead.leadId !== undefined) entry.leadId = lead.leadId;
                results.push(entry);
            }
        }

        return results;
    }
}

export const hunterService = new HunterService();
