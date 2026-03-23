class CacheService {
    private cache: Map<string, { value: any; expiry: number }> = new Map();

    set(key: string, value: any, ttlSeconds: number = 3600) {
        const expiry = Date.now() + ttlSeconds * 1000;
        this.cache.set(key, { value, expiry });
    }

    get(key: string) {
        const item = this.cache.get(key);
        if (!item) return null;

        if (Date.now() > item.expiry) {
            this.cache.delete(key);
            return null;
        }

        return item.value;
    }

    clear() {
        this.cache.clear();
    }
}

export const cacheService = new CacheService();
