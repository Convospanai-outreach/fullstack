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
        return prisma.settings.update({
            where: { userId },
            data
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

        return prisma.notificationSettings.update({
            where: { settingsId: settings.id },
            data
        });
    }
}

export const settingsService = new SettingsService();
