import axios from "axios";
import { logger } from "@/lib/logger";

export const WhatsAppService = {
  /**
   * Sends a message via WhatsApp Business API (Meta).
   * Requires valid credentials; no mock mode in production path.
   * `credentials` lets callers (e.g. per-team sequence sends) use a team's own
   * WABA instead of the global env-var account; omit to use the global account.
   */
  async sendMessage(
    leadId: string,
    message: string,
    isTemplate: boolean,
    recipientPhone: string,
    credentials?: { phoneNumberId: string; accessToken: string }
  ): Promise<boolean> {
    const phoneNumberId = credentials?.phoneNumberId || process.env["WHATSAPP_PHONE_NUMBER_ID"];
    const accessToken = credentials?.accessToken || process.env["WHATSAPP_ACCESS_TOKEN"];
    if (!phoneNumberId || !accessToken) {
      logger.error("[WhatsApp] Missing credentials for production send.");
      throw new Error("WhatsApp integration not configured (Missing Credentials)");
    }

    try {
      const url = `https://graph.facebook.com/v19.0/${phoneNumberId}/messages`;

      const payload: any = {
        messaging_product: "whatsapp",
        to: recipientPhone
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
          Authorization: `Bearer ${accessToken}`,
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
