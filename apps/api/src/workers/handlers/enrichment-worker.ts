export { handleLeadEnrichment } from "../../../workers/handlers/enrichment-worker";

export async function runEnrichment(_payload: any) {
    throw new Error("Enrichment is only available on the backend.");
}
