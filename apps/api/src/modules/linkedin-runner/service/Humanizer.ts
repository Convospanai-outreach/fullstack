import { logger } from "@/lib/logger";

export class Humanizer {
    async simulate() {
        // Random delay between 1-3 seconds to mimic human browsing
        const delay = Math.floor(Math.random() * 2000) + 1000;
        logger.info(`[Humanizer] Simulating human delay: ${delay}ms`);
        await new Promise(resolve => setTimeout(resolve, delay));
        return true;
    }
}
