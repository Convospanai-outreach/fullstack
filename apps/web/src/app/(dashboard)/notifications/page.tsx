"use client";

import { useEffect, useState } from "react";
import { SectionHeader } from "@/components/ui/SectionHeader";
import { GlassCard } from "@/components/ui/GlassCard";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";

interface Notification {
    id: string;
    type: string;
    message: string;
    createdAt: string;
    read: boolean;
}

export default function NotificationsPage() {
    const [notifications, setNotifications] = useState<Notification[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        fetch((process.env['NEXT_PUBLIC_API_URL'] || "/api/proxy") + "/notifications")
            .then(res => res.json())
            .then(data => {
                setNotifications(data);
                setLoading(false);
            })
            .catch(err => {
                console.error(err);
                setLoading(false);
            });
    }, []);

    const markRead = async (id: string) => {
        try {
            const res = await fetch((process.env['NEXT_PUBLIC_API_URL'] || "/api/proxy") + "/notifications", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ action: "markRead", id })
            });
            if (!res.ok) throw new Error("Failed to dismiss notification");
            setNotifications(prev => prev.filter(n => n.id !== id));
        } catch (err) {
            console.error(err);
            toast.error("Couldn't dismiss notification — try again");
        }
    };

    return (
        <div className="p-8 space-y-8">
            <SectionHeader title="Notifications" subtitle="Stay updated with system alerts" />

            <div className="space-y-4 max-w-3xl">
                {loading ? (
                    <div className="text-white/60">Loading notifications...</div>
                ) : notifications.length === 0 ? (
                    <div className="text-white/60">No new notifications.</div>
                ) : (
                    notifications.map(n => (
                        <GlassCard key={n.id} className="flex justify-between items-center p-4">
                            <div className="flex items-center gap-4">
                                <Badge variant={n.type === "SUCCESS" ? "success" : n.type === "WARNING" ? "warning" : "default"}>
                                    {n.type}
                                </Badge>
                                <div>
                                    <p className="text-white">{n.message}</p>
                                    <p className="text-xs text-white/40">{new Date(n.createdAt).toLocaleString()}</p>
                                </div>
                            </div>
                            <Button variant="ghost" onClick={() => markRead(n.id)} className="text-sm">
                                Dismiss
                            </Button>
                        </GlassCard>
                    ))
                )}
            </div>
        </div>
    );
}
