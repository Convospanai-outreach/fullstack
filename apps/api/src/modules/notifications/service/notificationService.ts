import { prisma } from "@/lib/db";

type NotificationType = "info" | "success" | "warning" | "error";

class NotificationService {
    async sendAlert(userId: string, type: NotificationType, message: string, meta?: any) {
        if (!userId) {
            throw new Error("Notification requires userId");
        }

        const notification = await prisma.notification.create({
            data: {
                userId,
                type,
                message,
                meta: meta || {},
                read: false
            }
        });

        return notification;
    }

    async list(userId: string, limit: number = 20) {
        return prisma.notification.findMany({
            where: { userId },
            orderBy: { createdAt: "desc" },
            take: limit
        });
    }

    async markRead(userId: string, notificationId: string) {
        return prisma.notification.update({
            where: { id: notificationId, userId },
            data: { read: true }
        });
    }
}

export const notificationService = new NotificationService();
