type NotificationType = "info" | "success" | "warning" | "error";

class NotificationService {
    async sendAlert(type: NotificationType, message: string, meta?: any) {
        const res = await fetch(process.env["NEXT_PUBLIC_API_URL"] + "/notifications", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ type, message, meta })
        });
        if (!res.ok) {
            const data = await res.json().catch(() => ({}));
            throw new Error(data.error || "Failed to send notification");
        }
        const data = await res.json();
        return data.notification;
    }

    async list() {
        const res = await fetch(process.env["NEXT_PUBLIC_API_URL"] + "/notifications");
        if (!res.ok) {
            const data = await res.json().catch(() => ({}));
            throw new Error(data.error || "Failed to load notifications");
        }
        const data = await res.json();
        return data.notifications || [];
    }
}

export const notificationService = new NotificationService();
