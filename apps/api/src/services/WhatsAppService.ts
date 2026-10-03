import axios from "axios";
import { logger } from "@/lib/logger";
import { GRAPH_VERSION } from "@/modules/whatsapp/wabaCredentials";

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
      const url = `https://graph.facebook.com/${GRAPH_VERSION}/${phoneNumberId}/messages`;

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
  },

  /**
   * Sends an approved template with numbered body values (whatsappTemplates.ts checks it first).
   * Payload per https://developers.facebook.com/documentation/business-messaging/whatsapp/templates/overview
   * (checked 2026-10-03). Values come from leads, so they're never logged.
   */
  async sendTemplate(
    to: string,
    template: { name: string; language: string; values: string[] },
    credentials: { phoneNumberId: string; accessToken: string }
  ): Promise<string | null> {
    const payload = {
      messaging_product: "whatsapp",
      recipient_type: "individual",
      to,
      type: "template",
      template: {
        name: template.name,
        language: { code: template.language },
        ...(template.values.length
          ? { components: [{ type: "body", parameters: template.values.map((text) => ({ type: "text", text })) }] }
          : {}),
      },
    };
    try {
      const res = await axios.post(`https://graph.facebook.com/${GRAPH_VERSION}/${credentials.phoneNumberId}/messages`, payload, {
        headers: { Authorization: `Bearer ${credentials.accessToken}`, "Content-Type": "application/json" },
        timeout: 10000,
      });
      return res.data?.messages?.[0]?.id ?? null;
    } catch (error: any) {
      const apiError = error.response?.data?.error;
      const detail = apiError ? `${apiError.code ?? ""} ${apiError.message ?? ""}`.trim() : error.message;
      logger.error(`[WhatsApp] Template ${template.name} send failed: ${detail}`);
      throw new Error(`WhatsApp API Error: ${detail}`);
    }
  }
};
