export const dummy = {}; // Logic migrated to backend

export async function runEnrichment(_payload: any) {
    throw new Error("Enrichment is only available on the backend.");
}
