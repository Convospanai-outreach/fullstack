let redisClient: any = null;

function resolveRedisUrl(): string | null {
    const explicit = (process.env["REDIS_URL"] || "").trim();
    if (explicit) {
        return process.env["NODE_ENV"] === "production"
            ? explicit
            : explicit.replace("redis://localhost", "redis://127.0.0.1");
    }

    const inCi = process.env["CI"] === "true" || process.env["GITHUB_ACTIONS"] === "true";
    const isProd = process.env["NODE_ENV"] === "production";
    const disabled = process.env["DISABLE_REDIS"] === "true";

    if (disabled || inCi) return null;

    if (isProd) {
        console.error("CRITICAL: REDIS_URL is missing in production! Distributed features will be disabled.");
        return null;
    }

    return "redis://127.0.0.1:6379";
}

export async function getRedisClient() {
    if (redisClient && redisClient.isOpen) {
        return redisClient;
    }

    const redisUrl = resolveRedisUrl();
    if (!redisUrl) return null;

    const { createClient } = await import("redis");

    redisClient = createClient({
        url: redisUrl,
        socket: {
            reconnectStrategy: (retries: number) => {
                if (retries > 10) {
                    console.error("Redis: Max reconnection attempts reached");
                    return new Error("Max reconnection attempts reached");
                }
                return Math.min(retries * 100, 3000);
            },
        },
    });

    redisClient.on("error", (err: Error) => {
        if (process.env["NODE_ENV"] !== "test") {
            console.error("Redis Client Error:", err);
        }
    });

    redisClient.on("connect", () => {
        if (process.env["NODE_ENV"] !== "test") {
            console.log("Redis connected");
        }
    });

    try {
        if (!redisClient.isOpen) {
            const connectPromise = redisClient.connect();
            const timeoutPromise = new Promise((_, reject) =>
                setTimeout(() => reject(new Error("Redis connection timeout")), 2000)
            );
            await Promise.race([connectPromise, timeoutPromise]);
        }
    } catch (error) {
        if (process.env["NODE_ENV"] !== "test") {
            console.error("Failed to connect to Redis:", error);
        }
        if (redisClient) {
            redisClient.destroy();
            redisClient = null;
        }
        // Do not throw, allow app to start without Redis
    }

    return redisClient;
}

export async function closeRedis() {
    if (redisClient && redisClient.isOpen) {
        await redisClient.quit();
        redisClient = null;
    }
}

export async function safeGet(key: string): Promise<string | null> {
    try {
        const client = await getRedisClient();
        if (!client || !client.isOpen) return null;
        return await client.get(key);
    } catch (error) {
        console.warn(`[Redis] safeGet failed for key ${key}:`, error);
        return null;
    }
}

export async function safeSet(key: string, value: string, ttlSeconds?: number): Promise<boolean> {
    try {
        const client = await getRedisClient();
        if (!client || !client.isOpen) return false;

        if (ttlSeconds) {
            await client.set(key, value, { EX: ttlSeconds });
        } else {
            await client.set(key, value);
        }
        return true;
    } catch (error) {
        console.warn(`[Redis] safeSet failed for key ${key}:`, error);
        return false;
    }
}

export async function safeDel(key: string): Promise<boolean> {
    try {
        const client = await getRedisClient();
        if (!client || !client.isOpen) return false;
        await client.del(key);
        return true;
    } catch (error) {
        console.warn(`[Redis] safeDel failed for key ${key}:`, error);
        return false;
    }
}
