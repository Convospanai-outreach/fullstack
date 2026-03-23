"use server";

import { HardwareService } from "@/services/HardwareService";
import { logger } from "@/lib/logger";

export async function setComplianceMode(region: 'INDIA' | 'EU'): Promise<void> {
    try {
        await HardwareService.setComplianceMode(region);
        logger.info(`[ServerAction] Compliance mode set to ${region} by user request.`);
    } catch (error: any) {
        logger.error(`[ServerAction] Failed to set compliance mode: ${error.message}`);
        throw new Error("Failed to update compliance mode on Edge Node.");
    }
}
