import { prisma } from "@/lib/db";
import { Resend } from "resend";
import { captureException } from "@/lib/sentry";

// Initialize Resend if API key is present
const resend = process.env["RESEND_API_KEY"] ? new Resend(process.env["RESEND_API_KEY"]) : null;

export type NotificationType = "CAMPAIGN" | "LEAD" | "SYSTEM" | "BILLING";

// System sender for notification emails (also used by the daily digest).
export const SYSTEM_EMAIL_FROM = "CraftMyFunnel <contact.us@craftmyfunnel.live>";

export class NotificationDispatcher {
    static async send(
        userId: string, type: NotificationType, title: string, message: string, meta?: any,
        alert?: { href: string; action: string; key: string },
    ) {
        try {
            // 1. Fetch User and Preferences
            // Only fetch what we need: email and the settings relation (and its sub-relation)
            const user = await prisma.user.findUnique({
                where: { id: userId },
                select: {
                    email: true,
                    settings: {
                        select: {
                            notifications: true
                        }
                    }
                }
            });

            if (!user) return;

            const prefs = user.settings?.notifications;

            // Default to TRUE if no prefs found (opt-out model)
            const emailEnabled = prefs ? prefs.emailGlobal : true;
            const inAppEnabled = prefs ? prefs.inAppGlobal : true;

            // 2. In-App Notification
            if (inAppEnabled || alert) {
                await prisma.notification.create({
                    data: {
                        userId,
                        type: type.toLowerCase(),
                        message: title + ": " + message,
                        meta
                    }
                });
            }

            // 3. Email Notification
            if (alert && emailEnabled && user.email) {
                const escape = (text: string) => text.replace(/[&<>"']/g, (c) => "&#" + c.charCodeAt(0) + ";");
                if (!resend) {
                    captureException(new Error("Mailbox reputation alert: system sender is unavailable"));
                    return;
                }
                const result = await resend.emails.send({
                    from: SYSTEM_EMAIL_FROM, to: user.email, subject: title,
                    html: "<p>" + escape(message) + "</p><p><a href=\x22" + escape(alert.href) + "\x22>" + escape(alert.action) + "</a></p>",
                }, { idempotencyKey: alert.key + ":" + userId });
                if (result.error) captureException(new Error("Mailbox reputation alert: system email was rejected"));
                return;
            }
            if (emailEnabled && user.email && resend) {
                // Check granular permissions
                let shouldSendEmail = true;
                if (type === "CAMPAIGN" && prefs && !prefs.emailCampaign) shouldSendEmail = false;
                if (type === "LEAD" && prefs && !prefs.emailLeads) shouldSendEmail = false;

                if (shouldSendEmail) {
                    await resend.emails.send({
                        from: SYSTEM_EMAIL_FROM,
                        to: user.email,
                        subject: `[CraftMyFunnel] ${title}`,
                        html: `<p>${message.replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`)}</p>`
                    });
                }
            }

        } catch (error) {
            if (alert) captureException(new Error("Mailbox reputation alert: dispatch failed"));
            else console.error("Notification Dispatch Error:", error);
        }
    }
}
