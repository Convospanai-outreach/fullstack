/**
 * Vector Store Shell
 * Migrated to backend.
 */
export const vectorStore = {
    search: async (_query?: any, _teamId?: any, _limit?: any, _maxTokens?: any): Promise<any[]> => [],
    addDocument: async (_content?: any, _knowledgeBaseId?: any, _metadata?: any): Promise<any> => ({ success: false }),
    formatContext: (_results?: any): string => ""
};
