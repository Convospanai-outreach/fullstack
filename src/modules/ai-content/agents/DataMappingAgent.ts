/**
 * Frontend shell for DataMappingAgent.
 * Logic has been migrated to the backend (convospan-api).
 */
export class DataMappingAgent {
    async suggestMapping(headers: string[]): Promise<Record<string, string>> {
        console.warn("DataMappingAgent is only available on the backend.");
        return {};
    }
}

export const dataMappingAgent = new DataMappingAgent();
