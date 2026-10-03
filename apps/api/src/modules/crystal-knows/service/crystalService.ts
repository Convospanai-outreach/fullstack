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

    /** Like generatePersonalityPrompt but also returns the DISC type/archetype, for persisting at enrichment time. */
    static async generatePersonalityGuidance(
        teamId: string,
        params: { id: string; objective?: string }
    ): Promise<{ prompt: string; discType: string | null; archetype: string | null } | null> {
        try {
            const apiKey = await getTeamCrystalApiKey(teamId);
            if (!apiKey) return null;
            const res = await new CrystalClient(apiKey).generatePrompt(params);
            if (!res.prompt) return null;
            return { prompt: res.prompt, discType: res.disc_type || null, archetype: res.archetype || null };
        } catch {
            return null;
        }
    }

    /**
     * Personality guidance text for drafting to a lead. Prefers the guidance
     * persisted by enrichment (no network call); falls back to the free live
     * generate_prompt call for leads enriched before it was stored. Returns ""
     * when the lead has no Crystal profile. Scoped to `teamId` like every other
     * Crystal call.
     */
    static async getGuidanceForLead(teamId: string | undefined, lead: any, objective: string): Promise<string> {
        const crystal = lead?.enrichedData?.crystalKnows;
        if (!teamId || !crystal) return "";
        if (typeof crystal.guidance?.prompt === "string" && crystal.guidance.prompt) return crystal.guidance.prompt;
        if (!crystal.profileId) return "";
        return (await CrystalService.generatePersonalityPrompt(teamId, { id: crystal.profileId, objective })) || "";
    }
}
