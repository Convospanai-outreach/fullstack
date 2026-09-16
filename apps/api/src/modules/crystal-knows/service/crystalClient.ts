// Low-level wrapper over the Crystal Knows Data API (https://api.crystalknows.com).
// Endpoints and credit/rate-limit semantics per Crystal's published Data API reference:
// GET /v4/profile spends 1 credit on a hit (deduped per profile); POST /v4/predictions
// spends 1 credit only if the job completes with a profile found;
// POST /v4/content/generate_prompt is free and deterministic.

const BASE_URL = "https://api.crystalknows.com";

export type CrystalProfileQuery = {
    full_name?: string;
    email?: string;
    linkedin_url?: string;
    job_title?: string;
    company_name?: string;
    phone?: string;
};

export type CrystalPredictionQuery = {
    name?: string;
    email?: string;
    linkedin_url?: string;
    job_title?: string;
    company_name?: string;
    phone?: string;
};

export type CrystalProfile = {
    id: string;
    first_name?: string;
    last_name?: string;
    photo_url?: string;
    url?: string;
    verified?: boolean;
    personalities?: Record<string, unknown>;
    content?: Record<string, unknown>;
    [key: string]: unknown;
};

export type CrystalPredictionJob = {
    job_id: string;
    status: "queued" | "processing" | "completed" | "failed";
    created_at?: string;
    completed_at?: string | null;
    result: {
        record_id?: string;
        state: "found" | "not_found" | "failure";
        profile: CrystalProfile | null;
        error: string | null;
    } | null;
};

export class CrystalApiError extends Error {
    status: number;
    constructor(status: number, message: string) {
        super(message);
        this.status = status;
        this.name = "CrystalApiError";
    }
}

export class CrystalClient {
    constructor(private apiKey: string) {}

    private async request<T>(path: string, init?: RequestInit): Promise<T> {
        // Every call site (getProfile/createPrediction/getPrediction/generatePrompt) relies
        // on this never hanging - a stalled Crystal connection must not be able to block
        // draft generation indefinitely or outlast findOrCreateProfile's own maxWaitMs budget.
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 15_000);
        let res: Response;
        try {
            res = await fetch(`${BASE_URL}${path}`, {
                ...init,
                headers: {
                    Authorization: `Bearer ${this.apiKey}`,
                    ...(init?.body ? { "Content-Type": "application/json" } : {}),
                    ...init?.headers,
                },
                signal: controller.signal,
            });
        } catch (error: any) {
            throw new CrystalApiError(0, error?.name === "AbortError" ? "Crystal API request timed out" : "Could not reach the Crystal API");
        } finally {
            clearTimeout(timeout);
        }

        if (res.status === 404) {
            throw new CrystalApiError(404, "not_found");
        }
        if (!res.ok) {
            let message = `Crystal API returned ${res.status}`;
            try {
                const body = await res.json();
                if (typeof body?.error === "string") message = body.error;
            } catch {
                // body wasn't JSON - keep the generic message
            }
            throw new CrystalApiError(res.status, message);
        }
        return res.json() as Promise<T>;
    }

    /** GET /v4/profile - real-time lookup only, does not create new profiles. Throws CrystalApiError(404) if unknown. */
    async getProfile(query: CrystalProfileQuery): Promise<CrystalProfile> {
        const params = new URLSearchParams();
        for (const [key, value] of Object.entries(query)) {
            if (value) params.set(key, value);
        }
        const { data } = await this.request<{ data: CrystalProfile }>(`/v4/profile?${params.toString()}`);
        return data;
    }

    /** POST /v4/predictions - async profile creation. Returns immediately with a job id. */
    async createPrediction(query: CrystalPredictionQuery, recordId: string): Promise<{ job_id: string; status: string }> {
        return this.request(`/v4/predictions`, {
            method: "POST",
            body: JSON.stringify({ query, record_id: recordId }),
        });
    }

    /** GET /v4/predictions/:job_id - poll for the result of a submitted prediction job. */
    async getPrediction(jobId: string): Promise<CrystalPredictionJob> {
        return this.request(`/v4/predictions/${encodeURIComponent(jobId)}`);
    }

    /** POST /v4/content/generate_prompt - free, deterministic. Pass exactly one of id/discType. */
    async generatePrompt(params: { id?: string; discType?: string; objective?: string }): Promise<{
        prompt: string;
        disc_type: string;
        archetype: string;
        guidance: Record<string, unknown>;
    }> {
        const body: Record<string, string> = {};
        if (params.id) body.id = params.id;
        else if (params.discType) body.disc_type = params.discType;
        if (params.objective) body.objective = params.objective;
        return this.request(`/v4/content/generate_prompt`, { method: "POST", body: JSON.stringify(body) });
    }
}
