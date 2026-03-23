import axios from "axios";
import { logger } from "@/lib/logger";

export const WhatsAppService = {
  /**
   * Sends a message via WhatsApp Business API (Meta).
   * Requires valid credentials; no mock mode in production path.
   */
  async sendMessage(leadId: string, message: string, isTemplate: boolean, recipientPhone: string): Promise<boolean> {
    const hasCredentials = !!process.env["WHATSAPP_ACCESS_TOKEN"] && !!process.env["WHATSAPP_PHONE_NUMBER_ID"];
    if (!hasCredentials) {
      logger.error("[WhatsApp] Missing credentials for production send.");
      throw new Error("WhatsApp integration not configured (Missing Credentials)");
    }

    try {
      const url = `https://graph.facebook.com/v19.0/${process.env["WHATSAPP_PHONE_NUMBER_ID"]}/messages`;

      const payload: any = {
        messaging_product: "whatsapp",
        to: recipientPhone
      };

      if (isTemplate) {
        payload.type = "template";
        payload.template = {
          name: message,
          language: { code: "en_US" }
        };
      } else {
        payload.type = "text";
        payload.text = { body: message };
      }

      await axios.post(url, payload, {
        headers: {
          Authorization: `Bearer ${process.env["WHATSAPP_ACCESS_TOKEN"]}`,
          "Content-Type": "application/json"
        },
        timeout: 5000
      });

      logger.info(`[WhatsApp] Message sent successfully to ${recipientPhone}`, { leadId });
      return true;
    } catch (error: any) {
      const apiError = error.response?.data?.error?.message || error.message;
      logger.error(`[WhatsApp] Failed to send message to ${recipientPhone}: ${apiError}`);
      throw new Error(`WhatsApp API Error: ${apiError}`);
    }
  }
};
