"use client";

import { useEffect, useState, useCallback } from "react";
import { Bell } from "lucide-react";
import { getBrowserApiBase } from "@/lib/api/browserBase";

const API_URL = getBrowserApiBase();

type NotificationItem = {
    id: string;
    type: "info" | "success" | "warning" | "error";
    message: string;
    createdAt: string;
    read: boolean;
};

export default function NotificationCenter() {
    const [notifications, setNotifications] = useState<NotificationItem[]>([]);
    const [isOpen, setIsOpen] = useState(false);
    const [unreadCount, setUnreadCount] = useState(0);

    const refreshNotifications = useCallback(async () => {
        try {
            const res = await fetch(`${API_URL}/notifications`);
            if (!res.ok) {
                throw new Error("Failed to fetch notifications");
            }
            const data = await res.json();
            const items = (data?.notifications || []) as NotificationItem[];
            setNotifications(items);
            setUnreadCount(items.filter((n) => !n.read).length);
        } catch (error) {
            console.error("Failed to load notifications", error);
        }
    }, []);

    const markAllRead = useCallback(async () => {
        try {
            const res = await fetch(`${API_URL}/notifications`, {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ all: true })
            });
            if (!res.ok) {
                throw new Error("Failed to mark notifications as read");
            }
            setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
            setUnreadCount(0);
        } catch (error) {
            console.error("Failed to mark notifications", error);
        }
    }, []);

    useEffect(() => {
        refreshNotifications();
    }, [refreshNotifications]);

    const toggleOpen = async () => {
        const next = !isOpen;
        setIsOpen(next);
        if (next && unreadCount > 0) {
            await markAllRead();
        }
    };

    return (
        <div style={{ position: "relative" }}>
            <button
                onClick={toggleOpen}
                style={{
                    background: "none",
                    border: "none",
                    cursor: "pointer",
                    position: "relative",
                    padding: 8
                }}
            >
                <Bell style={{ width: 20, height: 20, color: "#e5e7eb" }} />
                {unreadCount > 0 && (
                    <span style={{
                        position: "absolute",
                        top: 0,
                        right: 0,
                        background: "#ef4444",
                        color: "#fff",
                        fontSize: 10,
                        fontWeight: "bold",
                        borderRadius: "50%",
                        width: 16,
                        height: 16,
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center"
                    }}>
                        {unreadCount}
                    </span>
                )}
            </button>

            {isOpen && (
                <div style={{
                    position: "absolute",
                    top: 40,
                    right: 0,
                    width: 320,
                    background: "#fff",
                    borderRadius: 8,
                    boxShadow: "0 4px 12px rgba(0,0,0,0.15)",
                    border: "1px solid #eee",
                    zIndex: 1000
                }}>
                    <div style={{ padding: "12px 16px", borderBottom: "1px solid #eee", fontWeight: 600 }}>
                        Notifications
                    </div>
                    <div style={{ maxHeight: 300, overflowY: "auto" }}>
                        {notifications.length === 0 ? (
                            <div style={{ padding: 16, textAlign: "center", color: "#999", fontSize: 14 }}>
                                No notifications
                            </div>
                        ) : (
                            notifications.map((n) => (
                                <div key={n.id} style={{ padding: "12px 16px", borderBottom: "1px solid #f9fafb", background: n.read ? "#fff" : "#f0f9ff" }}>
                                    <div style={{ fontSize: 14, marginBottom: 4 }}>{n.message}</div>
                                    <div style={{ fontSize: 11, color: "#9ca3af" }}>
                                        {new Date(n.createdAt).toLocaleString()}
                                    </div>
                                </div>
                            ))
                        )}
                    </div>
                </div>
            )}
        </div>
    );
}
