"use client";

import { useState } from "react";
import useSWR from "swr";
import { getBrowserApiUrl } from "@/lib/api/browserBase";

const fetcher = (url: string) => fetch(url).then(res => res.json());

export default function NotificationBell() {
    const { data: notifications, mutate } = useSWR(getBrowserApiUrl("/notifications"), fetcher, { refreshInterval: 10000 });
    const [open, setOpen] = useState(false);

    const unreadCount = notifications ? notifications.filter((n: any) => !n.read).length : 0;

    const handleMarkRead = async (id: string, e: React.MouseEvent) => {
        e.stopPropagation();
        try {
            await fetch(getBrowserApiUrl(`/notifications/${id}`), { method: "PATCH" });
            mutate(); // Refresh
        } catch (e) {
            console.error(e);
        }
    };

    return (
        <div className="relative">
            <button
                className="p-3 rounded-full bg-white/5 hover:bg-white/10 transition relative text-xl"
                onClick={() => setOpen(!open)}
            >
                🔔
                {unreadCount > 0 && (
                    <span className="absolute top-1 right-1 w-5 h-5 bg-red-500 rounded-full text-xs flex items-center justify-center text-white border border-black">
                        {unreadCount}
                    </span>
                )}
            </button>

            {open && (
                <>
                    <div
                        className="fixed inset-0 z-10"
                        onClick={() => setOpen(false)}
                    />
                    <div className="absolute right-0 mt-2 w-80 bg-[#161b22] border border-white/10 rounded-xl shadow-2xl z-20 overflow-hidden">
                        <div className="p-3 border-b border-white/10 font-semibold text-sm">Notifications</div>
                        <div className="max-h-80 overflow-y-auto">
                            {!notifications || notifications.length === 0 ? (
                                <div className="p-4 text-center text-sm text-gray-400">No notifications</div>
                            ) : (
                                notifications.map((n: any) => (
                                    <div
                                        key={n.id}
                                        className={`p-3 border-b border-white/5 hover:bg-white/5 transition flex gap-3 ${n.read ? "opacity-50" : "bg-purple-500/5"}`}
                                    >
                                        <div className="text-xl">
                                            {n.type === "alert" ? "⚠️" : n.type === "success" ? "✅" : "ℹ️"}
                                        </div>
                                        <div className="flex-1">
                                            <div className="text-sm text-white">{n.message}</div>
                                            <div className="text-xs text-gray-500 mt-1">{new Date(n.createdAt).toLocaleTimeString()}</div>
                                        </div>
                                        {!n.read && (
                                            <button
                                                onClick={(e) => handleMarkRead(n.id, e)}
                                                className="text-xs text-blue-400 hover:text-blue-300 self-start"
                                                title="Mark as read"
                                            >
                                                •
                                            </button>
                                        )}
                                    </div>
                                ))
                            )}
                        </div>
                    </div>
                </>
            )}
        </div>
    );
}
