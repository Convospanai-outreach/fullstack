import { prisma } from "@/lib/db";

export class NotificationService {
    static async createNotification(userId: string, type: string, message: string, meta?: any) {
        try {
            return await prisma.notification.create({
                data: {
                    userId,
                    type,
                    message,
                    meta: meta || {},
                }
            });
        } catch (error) {
            console.error("Failed to create notification:", error);
            return null;
        }
    }

    static async getUnread(userId: string) {
        try {
            return await prisma.notification.findMany({
                where: {
                    userId,
                    read: false
                },
                orderBy: {
                    createdAt: "desc"
                }
            });
        } catch (error) {
            console.error("Failed to fetch notifications:", error);
            return [];
        }
    }

    static async markAsRead(notificationId: string) {
        try {
            await prisma.notification.update({
                where: { id: notificationId },
                data: { read: true }
            });
            return true;
        } catch (error) {
            console.error("Failed to mark notification as read:", error);
            return false;
        }
    }
}
