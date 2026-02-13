import axios from "axios";
import { logger } from "@/lib/logger";

export const WhatsAppService = {
  /**
   * Sends a message via WhatsApp Business API (Meta).
   * Supports MOCK_MODE for testing without credentials.
   */
  async sendMessage(leadId: string, message: string, isTemplate: boolean, recipientPhone: string): Promise<boolean> {
    // Check for Mock Mode explicitly or Default to Mock in Dev if no credentials
    const hasCredentials = !!process.env['WHATSAPP_ACCESS_TOKEN'] && !!process.env['WHATSAPP_PHONE_NUMBER_ID'];
    const isMock = process.env['WHATSAPP_MOCK_MODE'] === "true" || (!hasCredentials && process.env.NODE_ENV !== "production");

    if (isMock) {
      logger.info(`[WhatsApp Mock] 📱 Message simulated to Lead ${leadId} (${recipientPhone})`, { 
        message: message.substring(0, 50) + (message.length > 50 ? "..." : ""), 
        isTemplate 
      });
      
      await new Promise(resolve => setTimeout(resolve, 500));
      return true;
    }

    if (!hasCredentials) {
      logger.error("[WhatsApp] Missing credentials for production send.");
      throw new Error("WhatsApp integration not configured (Missing Credentials)");
    }

    try {
      const url = `https://graph.facebook.com/v19.0/${process.env.WHATSAPP_PHONE_NUMBER_ID}/messages`;
      
      const payload: any = {
        messaging_product: "whatsapp",
        to: recipientPhone,
      };

      if (isTemplate) {
        payload.type = "template";
        payload.template = {
          name: message, // Message represents template name in this context
          language: { code: "en_US" }
        };
      } else {
        payload.type = "text";
        payload.text = { body: message };
      }

      await axios.post(url, payload, {
        headers: {
          'Authorization': `Bearer ${process.env.WHATSAPP_ACCESS_TOKEN}`,
          'Content-Type': 'application/json'
        },
        timeout: 5000
      });

      logger.info(`[WhatsApp] 📱 Message sent successfully to ${recipientPhone}`);
      return true;
    } catch (error: any) {
      const apiError = error.response?.data?.error?.message || error.message;
      logger.error(`[WhatsApp] Failed to send message to ${recipientPhone}: ${apiError}`);
      throw new Error(`WhatsApp API Error: ${apiError}`);
    }
  }
}
