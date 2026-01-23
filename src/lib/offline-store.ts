import Dexie, { Table } from 'dexie';

export interface OfflineRequest {
    id?: number;
    url: string;
    method: string;
    body: any;
    timestamp: number;
    synced: boolean;
}

export class ConvoSpanDatabase extends Dexie {
    offlineRequests!: Table<OfflineRequest>;

    constructor() {
        super('ConvoSpanEdgeDB');
        this.version(1).stores({
            offlineRequests: '++id, timestamp, synced'
        });
    }
}

export const db = new ConvoSpanDatabase();

export const offlineStore = {
    async queueRequest(url: string, method: string, body: any) {
        await db.offlineRequests.add({
            url,
            method,
            body,
            timestamp: Date.now(),
            synced: false
        });
        console.log(`[OfflineStore] Request queued: ${method} ${url}`);
    },

    async getPendingRequests() {
        return await db.offlineRequests.filter(req => !req.synced).toArray();
    },

    async markSynced(id: number) {
        await db.offlineRequests.update(id, { synced: true });
    },

    async clearSynced() {
        await db.offlineRequests.filter(req => req.synced).delete();
    }
};
