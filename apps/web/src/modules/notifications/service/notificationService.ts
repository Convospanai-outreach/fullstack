type NotificationType = "info" | "success" | "warning" | "error";

class NotificationService {
    private subscribers: ((notification: any) => void)[] = [];

    async sendAlert(type: NotificationType, message: string) {
        // Mock sending alert to external channels (Email, Slack)
        console.log(`[Notification] ${type.toUpperCase()}: ${message}`);

        // In a real app, we'd persist this to DB and push via Websockets
        const notification = {
            id: Math.random().toString(36).substr(2, 9),
            type,
            message,
            createdAt: new Date().toISOString(),
            read: false,
        };

        // Notify in-memory subscribers (mock websocket)
        this.subscribers.forEach(cb => cb(notification));

        return notification;
    }

    subscribe(callback: (notification: any) => void) {
        this.subscribers.push(callback);
        return () => {
            this.subscribers = this.subscribers.filter(cb => cb !== callback);
        };
    }
}

export const notificationService = new NotificationService();
