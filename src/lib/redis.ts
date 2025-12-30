import { createClient } from "redis";

let redisClient: ReturnType<typeof createClient> | null = null;

export async function getRedisClient() {
    if (redisClient && redisClient.isOpen) {
        return redisClient;
    }

    const redisUrl = process.env['REDIS_URL'] || "redis://localhost:6379";

    redisClient = createClient({
        url: redisUrl,
        socket: {
            reconnectStrategy: (retries: number) => {
                if (retries > 10) {
                    console.error("Redis: Max reconnection attempts reached");
                    return new Error("Max reconnection attempts reached");
                }
                return Math.min(retries * 100, 3000);
            }
        }
    });

    redisClient.on("error", (err: Error) => {
        console.error("Redis Client Error:", err);
    });

    redisClient.on("connect", () => {
        console.log("✅ Redis connected");
    });

    await redisClient.connect();
    return redisClient;
}

export async function closeRedis() {
    if (redisClient && redisClient.isOpen) {
        await redisClient.quit();
        redisClient = null;
    }
}
