import { prisma } from "@/lib/db";
import { Resend } from "resend";

// Initialize Resend if API key is present
const resend = process.env["RESEND_API_KEY"] ? new Resend(process.env["RESEND_API_KEY"]) : null;

export type NotificationType = "CAMPAIGN" | "LEAD" | "SYSTEM" | "BILLING";

export class NotificationDispatcher {
    static async send(userId: string, type: NotificationType, title: string, message: string, meta?: any) {
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
            if (inAppEnabled) {
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
            if (emailEnabled && user.email && resend) {
                // Check granular permissions
                let shouldSendEmail = true;
                if (type === "CAMPAIGN" && prefs && !prefs.emailCampaign) shouldSendEmail = false;
                if (type === "LEAD" && prefs && !prefs.emailLeads) shouldSendEmail = false;

                if (shouldSendEmail) {
                    await resend.emails.send({
                        from: 'CraftMyFunnel <notifications@craftmyfunnel.live>',
                        to: user.email,
                        subject: `[CraftMyFunnel] ${title}`,
                        html: `<p>${message}</p>`
                    });
                }
            }

        } catch (error) {
            console.error("Notification Dispatch Error:", error);
        }
    }
}
