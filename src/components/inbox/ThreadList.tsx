"use client";

import React from "react";
import { Thread } from "@/lib/inboxService";
import { cn } from "@/lib/utils";

interface ThreadListProps {
    threads: Thread[];
    selectedThreadId?: string;
    onSelectThread: (id: string) => void;
}

export function ThreadList({ threads, selectedThreadId, onSelectThread }: ThreadListProps) {
    return (
        <div className="flex flex-col h-full overflow-y-auto border-r border-white/10 bg-white/5">
            <div className="p-4 border-b border-white/10">
                <h2 className="text-lg font-semibold text-white">Messages</h2>
            </div>
            <div className="flex-1">
                {threads.map((thread) => (
                    <div
                        key={thread.id}
                        onClick={() => onSelectThread(thread.id)}
                        className={cn(
                            "p-4 cursor-pointer hover:bg-white/10 transition-colors border-b border-white/5",
                            selectedThreadId === thread.id ? "bg-white/10 border-l-4 border-l-blue-500" : ""
                        )}
                    >
                        <div className="flex justify-between items-start mb-1">
                            <h3 className="font-medium text-white">{thread.leadName}</h3>
                            {thread.unreadCount > 0 && (
                                <span className="bg-blue-500 text-white text-xs px-2 py-0.5 rounded-full">
                                    {thread.unreadCount}
                                </span>
                            )}
                        </div>
                        <p className="text-sm text-white/60 line-clamp-2">{thread.lastMessage}</p>
                        <div className="mt-2 text-xs text-white/40">
                            {thread.lastMessageAt && new Date(thread.lastMessageAt).toLocaleDateString()}
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
}
