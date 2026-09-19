import { getTeamCrystalApiKey } from "../crystalCredentials";
import { CrystalApiError, CrystalClient, CrystalProfile, CrystalProfileQuery } from "./crystalClient";

export type CrystalLookupResult =
    | { state: "not_configured" }
    | { state: "found"; profile: CrystalProfile }
    | { state: "not_found" }
    | { state: "pending"; jobId: string }
    | { state: "error"; error: string };

function sleep(ms: number) {
    return new Promise((resolve) => setTimeout(resolve, ms));
}

export class CrystalService {
    /**
     * Looks up a profile Crystal already knows (free of async wait); if it
     * doesn't exist, submits a prediction job and polls it for up to
     * `maxWaitMs` (jobs "typically complete within tens of seconds" per
     * Crystal's docs). Returns `pending` with a job id if it doesn't finish
     * in time, rather than blocking indefinitely - callers may resubmit the
     * same `recordId` later; it won't double-charge.
     */
    static async findOrCreateProfile(
        teamId: string,
        query: CrystalProfileQuery & { name?: string },
        options: { recordId: string; maxWaitMs?: number; pollIntervalMs?: number }
    ): Promise<CrystalLookupResult> {
        const apiKey = await getTeamCrystalApiKey(teamId);
        if (!apiKey) return { state: "not_configured" };

        const client = new CrystalClient(apiKey);

        try {
            const profile = await client.getProfile(query);
            return { state: "found", profile };
        } catch (error) {
            if (!(error instanceof CrystalApiError) || error.status !== 404) {
                return { state: "error", error: error instanceof Error ? error.message : "Unknown Crystal API error" };
            }
        }

        try {
            const { job_id } = await client.createPrediction(
                {
                    name: query.name || query.full_name,
                    email: query.email,
                    linkedin_url: query.linkedin_url,
                    job_title: query.job_title,
                    company_name: query.company_name,
                    phone: query.phone,
                },
                options.recordId
            );

            const maxWaitMs = options.maxWaitMs ?? 25_000;
            const pollIntervalMs = options.pollIntervalMs ?? 3_000;
            const deadline = Date.now() + maxWaitMs;

            while (Date.now() < deadline) {
                await sleep(pollIntervalMs);
                const job = await client.getPrediction(job_id);
                if (job.status === "completed") {
                    if (job.result?.state === "found" && job.result.profile) {
                        return { state: "found", profile: job.result.profile };
                    }
                    if (job.result?.state === "not_found") {
                        return { state: "not_found" };
                    }
                    return { state: "error", error: job.result?.error || "Crystal prediction job failed." };
                }
                if (job.status === "failed") {
                    return { state: "error", error: "Crystal prediction job failed." };
                }
            }

            return { state: "pending", jobId: job_id };
        } catch (error) {
            return { state: "error", error: error instanceof Error ? error.message : "Unknown Crystal API error" };
        }
    }

    /** POST /v4/content/generate_prompt - free. Best-effort: returns null on any failure. */
    static async generatePersonalityPrompt(
        teamId: string,
        params: { id?: string; discType?: string; objective?: string }
    ): Promise<string | null> {
        try {
            const apiKey = await getTeamCrystalApiKey(teamId);
            if (!apiKey || (!params.id && !params.discType)) return null;
            const client = new CrystalClient(apiKey);
            const { prompt } = await client.generatePrompt(params);
            return prompt || null;
        } catch {
            return null;
        }
    }
}
