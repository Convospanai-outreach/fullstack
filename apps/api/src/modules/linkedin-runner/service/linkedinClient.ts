import { runLinkedInAction } from "@/linkedin/puppeteerRunner";
import { logger } from "@/lib/logger";

export class LinkedInRunner {
    constructor() {
        logger.info("LinkedInRunner initialized on backend.");
    }

    async run(params: { profileUrl: string; action: string }) {
        logger.info(`[LinkedInRunner] Running action: ${params.action}`);
        return await runLinkedInAction(params);
    }
}
