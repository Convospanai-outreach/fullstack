import axios from "axios";

const HUNTER_API_BASE = "https://api.hunter.io/v2";
const API_KEY = process.env['HUNTER_IO_API_KEY'];

export type EmailFinderResult = {
    email: string | null;
    score: number;
    firstName: string;
    lastName: string;
    position: string | null;
    company: string;
    sources: Array<{
        domain: string;
        uri: string;
        extracted_on: string;
    }>;
};

export type EmailVerificationResult = {
    email: string;
    status: "valid" | "invalid" | "accept_all" | "webmail" | "disposable" | "unknown";
    score: number;
    regexp: boolean;
    gibberish: boolean;
    disposable: boolean;
    webmail: boolean;
    mx_records: boolean;
    smtp_server: boolean;
    smtp_check: boolean;
    accept_all: boolean;
};

export type DomainSearchResult = {
    domain: string;
    organization: string;
    emails: Array<{
        value: string;
        type: string;
        confidence: number;
        firstName: string;
        lastName: string;
        position: string;
    }>;
};

class HunterClient {
    private apiKey: string;

    constructor() {
        // Allow instantiation without key for build time, but methods will fail if not set at runtime
        this.apiKey = API_KEY || "";
    }

    private checkKey() {
        if (!this.apiKey) {
            throw new Error("HUNTER_IO_API_KEY is not set in environment variables");
        }
    }

    /**
     * Find email address for a person
     * @param firstName - First name
     * @param lastName - Last name
     * @param domain - Company domain (e.g., "google.com")
     */
    async findEmail(
        firstName: string,
        lastName: string,
        domain: string
    ): Promise<EmailFinderResult> {
        this.checkKey();
        try {
            const response = await axios.get(`${HUNTER_API_BASE}/email-finder`, {
                params: {
                    domain,
                    first_name: firstName,
                    last_name: lastName,
                    api_key: this.apiKey,
                },
            });

            const data = response.data.data;
            return {
                email: data.email,
                score: data.score,
                firstName: data.first_name,
                lastName: data.last_name,
                position: data.position,
                company: data.company,
                sources: data.sources || [],
            };
        } catch (error: any) {
            if (error.response?.status === 429) {
                throw new Error("Hunter.io rate limit exceeded");
            }
            throw new Error(`Hunter.io API error: ${error.message}`);
        }
    }

    /**
     * Verify an email address
     * @param email - Email to verify
     */
    async verifyEmail(email: string): Promise<EmailVerificationResult> {
        this.checkKey();
        try {
            const response = await axios.get(`${HUNTER_API_BASE}/email-verifier`, {
                params: {
                    email,
                    api_key: this.apiKey,
                },
            });

            const data = response.data.data;
            return {
                email: data.email,
                status: data.status,
                score: data.score,
                regexp: data.regexp,
                gibberish: data.gibberish,
                disposable: data.disposable,
                webmail: data.webmail,
                mx_records: data.mx_records,
                smtp_server: data.smtp_server,
                smtp_check: data.smtp_check,
                accept_all: data.accept_all,
            };
        } catch (error: any) {
            if (error.response?.status === 429) {
                throw new Error("Hunter.io rate limit exceeded");
            }
            throw new Error(`Hunter.io API error: ${error.message}`);
        }
    }

    /**
     * Search for all emails associated with a domain
     * @param domain - Company domain
     * @param limit - Max results (default: 10)
     */
    async domainSearch(domain: string, limit: number = 10): Promise<DomainSearchResult> {
        this.checkKey();
        try {
            const response = await axios.get(`${HUNTER_API_BASE}/domain-search`, {
                params: {
                    domain,
                    limit,
                    api_key: this.apiKey,
                },
            });

            const data = response.data.data;
            return {
                domain: data.domain,
                organization: data.organization,
                emails: data.emails.map((e: any) => ({
                    value: e.value,
                    type: e.type,
                    confidence: e.confidence,
                    firstName: e.first_name,
                    lastName: e.last_name,
                    position: e.position,
                })),
            };
        } catch (error: any) {
            if (error.response?.status === 429) {
                throw new Error("Hunter.io rate limit exceeded");
            }
            throw new Error(`Hunter.io API error: ${error.message}`);
        }
    }
    /**
     * Enrich a company by domain
     * @param domain - Company domain
     */
    async companyEnrichment(domain: string): Promise<any> {
        this.checkKey();
        try {
            const response = await axios.get(`${HUNTER_API_BASE}/companies/find`, {
                params: {
                    domain,
                    api_key: this.apiKey,
                },
            });
            return response.data.data;
        } catch (error: any) {
            if (error.response?.status === 429) throw new Error("Hunter.io rate limit exceeded");
            throw new Error(`Hunter.io API error: ${error.message}`);
        }
    }

    /**
     * Enrich a person by email
     * @param email - Person's email
     */
    async personEnrichment(email: string): Promise<any> {
        this.checkKey();
        try {
            const response = await axios.get(`${HUNTER_API_BASE}/people/find`, {
                params: {
                    email,
                    api_key: this.apiKey,
                },
            });
            return response.data.data;
        } catch (error: any) {
            if (error.response?.status === 429) throw new Error("Hunter.io rate limit exceeded");
            throw new Error(`Hunter.io API error: ${error.message}`);
        }
    }

    /**
     * Combined enrichment (Person + Company) by email
     * @param email - Person's email
     */
    async combinedEnrichment(email: string): Promise<any> {
        this.checkKey();
        try {
            const response = await axios.get(`${HUNTER_API_BASE}/combined/find`, {
                params: {
                    email,
                    api_key: this.apiKey,
                },
            });
            return response.data.data;
        } catch (error: any) {
            if (error.response?.status === 429) throw new Error("Hunter.io rate limit exceeded");
            throw new Error(`Hunter.io API error: ${error.message}`);
        }
    }
}

export const hunterClient = new HunterClient();
