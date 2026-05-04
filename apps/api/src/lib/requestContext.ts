import { AsyncLocalStorage } from 'node:async_hooks';

interface RequestContextData {
    correlationId: string;
    request?: Request;
    userId?: string;
    teamId?: string;
}

export class RequestContext {
    private static storage = new AsyncLocalStorage<RequestContextData>();

    static run<T>(data: RequestContextData, fn: () => T): T {
        return this.storage.run(data, fn);
    }

    static get(): RequestContextData | undefined {
        return this.storage.getStore();
    }

    static getCorrelationId(): string | undefined {
        return this.storage.getStore()?.correlationId;
    }
}
