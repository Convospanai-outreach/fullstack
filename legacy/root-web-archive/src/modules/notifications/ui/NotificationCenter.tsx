"use client";

import { useState, useEffect } from "react";

export default function NotificationCenter() {
    const [notifications, setNotifications] = useState<any[]>([]);
    const [isOpen, setIsOpen] = useState(false);
    const [unreadCount, setUnreadCount] = useState(0);

    useEffect(() => {
        // Mock receiving initial notifications
        setNotifications([
            { id: "1", type: "success", message: "Campaign 'Outreach Q1' finished successfully", createdAt: new Date().toISOString(), read: false },
            { id: "2", type: "warning", message: "Worker queue load is high", createdAt: new Date(Date.now() - 3600000).toISOString(), read: true },
        ]);
        setUnreadCount(1);
    }, []);

    const toggleOpen = () => {
        setIsOpen(!isOpen);
        if (!isOpen) {
            // Mark all as read
            setUnreadCount(0);
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
                <span style={{ fontSize: 20 }}>🔔</span>
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
                            notifications.map(n => (
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
