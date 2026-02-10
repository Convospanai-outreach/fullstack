import { logger } from "@/lib/logger";

export const WhatsAppService = {
  /**
   * Sends a message via WhatsApp Business API (Meta).
   * Supports MOCK_MODE for testing without credentials.
   */
  async sendMessage(leadId: string, message: string, isTemplate: boolean): Promise<boolean> {
    // Check for Mock Mode explicitly or Default to Mock in Dev if no credentials
    const hasCredentials = !!process.env['WHATSAPP_ACCESS_TOKEN'];
    const isMock = process.env['WHATSAPP_MOCK_MODE'] === "true" || (!hasCredentials && process.env.NODE_ENV !== "production");

    if (isMock) {
      logger.info(`[WhatsApp Mock] 📱 Message simulated to Lead ${leadId}`, { 
        message: message.substring(0, 50) + (message.length > 50 ? "..." : ""), 
        isTemplate 
      });
      
      // Simulate network delay (Meta API usually takes ~300-600ms)
      await new Promise(resolve => setTimeout(resolve, 500));
      return true;
    }

    // --- Real Implementation Starts Here ---
    
    if (!process.env['WHATSAPP_ACCESS_TOKEN'] || !process.env['WHATSAPP_PHONE_NUMBER_ID']) {
      logger.error("[WhatsApp] Missing credentials for production send.");
      throw new Error("WhatsApp integration not configured (Missing Credentials)");
    }

    // TODO: Implement actual Meta Graph API call
    // const url = `https://graph.facebook.com/v19.0/${process.env.WHATSAPP_PHONE_NUMBER_ID}/messages`;
    // const response = await fetch(url, { ... });

    // For now, if we reach here without credentials, we failed the guard above.
    // If we have credentials but no code, throw error.
    throw new Error("Production WhatsApp implementation pending URL configuration.");
  }
}
