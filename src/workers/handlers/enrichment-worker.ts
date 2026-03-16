export { handleLeadEnrichment } from "../../../convospan-api/workers/handlers/enrichment-worker";

export async function runEnrichment(_payload: any) {
    throw new Error("Enrichment is only available on the backend.");
}
