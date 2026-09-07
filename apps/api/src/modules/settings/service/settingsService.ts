import { prisma } from "@/lib/db";

class SettingsService {
    /**
     * Get settings for a user (or default if null)
     */
    async getSettings(userId: string) {
        let settings = await prisma.settings.findUnique({
            where: { userId },
            include: { notifications: true }
        });

        if (!settings) {
            // Auto-create default settings
            settings = await prisma.settings.create({
                data: {
                    userId,
                    notifications: {
                        create: {
                            userId // Required by schema
                        }
                    }
                },
                include: { notifications: true }
            });
        } else if (!settings.notifications) {
            // Heal: Create notifications if settings exist but relation is missing
            const notifs = await prisma.notificationSettings.create({
                data: {
                    settingsId: settings.id,
                    userId
                }
            });
            settings.notifications = notifs;
        }

        return settings;
    }

    /**
     * Update top-level settings (API Keys, Theme, etc)
     */
    async updateSettings(userId: string, data: any) {
        // Explicit allowlist - `data` is untrusted request-body input, and Settings.userId
        // is a unique FK to User: passing it through unchecked would let a caller re-key
        // their own Settings row to another user's userId, hijacking that account's settings.
        const { name, email, theme, apiKeyOpenAI, apiKeyGemini, hubspotApiKey, crmConfig, liCookie } = data ?? {};
        return prisma.settings.update({
            where: { userId },
            data: { name, email, theme, apiKeyOpenAI, apiKeyGemini, hubspotApiKey, crmConfig, liCookie }
        });
    }

    /**
     * Update Notification preferences
     */
    async updateNotifications(userId: string, data: any) {
        const settings = await this.getSettings(userId);

        // Ensure notifications record exists (handled by getSettings, but just in case)
        if (!settings.notifications) {
            await prisma.notificationSettings.create({
                data: { settingsId: settings.id, userId }
            });
        }

        // Explicit allowlist - see updateSettings for why `data` must not be passed through raw.
        const { emailGlobal, emailCampaign, emailLeads, inAppGlobal } = data ?? {};
        return prisma.notificationSettings.update({
            where: { settingsId: settings.id },
            data: { emailGlobal, emailCampaign, emailLeads, inAppGlobal }
        });
    }
}

export const settingsService = new SettingsService();
