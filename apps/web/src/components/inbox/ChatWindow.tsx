"use client";

import { useState, useEffect, useRef } from "react";
import { Message } from "@/lib/inboxService";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { getBrowserApiBase } from "@/lib/api/browserBase";

interface ChatWindowProps {
    threadId: string;
}

export function ChatWindow({ threadId }: ChatWindowProps) {
    const [messages, setMessages] = useState<Message[]>([]);
    const [newMessage, setNewMessage] = useState("");
    const [loading, setLoading] = useState(true);
    const messagesEndRef = useRef<HTMLDivElement>(null);

    const [suggestions, setSuggestions] = useState<string[]>([]);
    const [suggestionsLoading, setSuggestionsLoading] = useState(false);

    useEffect(() => {
        setLoading(true);
        setSuggestions([]); // Clear previous suggestions
        fetch(`${getBrowserApiBase()}/inbox/${threadId}`)
            .then(res => res.json())
            .then(data => {
                setMessages(data);
                setLoading(false);
                scrollToBottom();

                // Fetch suggestions after messages are loaded
                fetchSuggestions();
            });
    }, [threadId]);

    const fetchSuggestions = async () => {
        setSuggestionsLoading(true);
        try {
            const res = await fetch(`${getBrowserApiBase()}/inbox/${threadId}/suggest`);
            const data = await res.json();
            if (data.suggestions) {
                setSuggestions(data.suggestions);
            }
        } catch (error) {
            console.error("Failed to fetch suggestions", error);
        } finally {
            setSuggestionsLoading(false);
        }
    };

    const scrollToBottom = () => {
        messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    };

    const handleSend = async () => {
        if (!newMessage.trim()) return;

        const tempId = Date.now().toString();
        const tempMsg: Message = {
            id: tempId,
            threadId,
            sender: "me",
            content: newMessage,
            createdAt: new Date()
        };

        // Optimistic update
        setMessages(prev => [...prev, tempMsg]);
        setNewMessage("");
        setSuggestions([]); // Clear suggestions after sending
        scrollToBottom();

        try {
            await fetch(`${getBrowserApiBase()}/inbox/${threadId}`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ content: tempMsg.content })
            });

            // Re-fetch suggestions based on new context
            // setTimeout(() => fetchSuggestions(), 1000); 
        } catch (error) {
            console.error("Failed to send message", error);
            // Revert optimistic update if needed
        }
    };

    if (loading) return <div className="flex-1 flex items-center justify-center text-white/60">Loading...</div>;

    return (
        <div className="flex flex-col h-full bg-surface-panel">
            {/* Messages Area */}
            <div className="flex-1 overflow-y-auto p-6 space-y-4">
                {messages.map((msg) => (
                    <div
                        key={msg.id}
                        className={cn(
                            "max-w-[70%] p-4 rounded-xl",
                            msg.sender === "me"
                                ? "ml-auto bg-brand-600 text-white rounded-tr-none"
                                : "bg-muted text-foreground rounded-tl-none"
                        )}
                    >
                        <p>{msg.content}</p>
                        <div className={cn(
                            "text-xs mt-1",
                            msg.sender === "me" ? "text-brand-100" : "text-muted-foreground"
                        )}>
                            {new Date(msg.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </div>
                    </div>
                ))}
                <div ref={messagesEndRef} />
            </div>

            {/* Smart Replies */}
            <div className="px-4 py-2 flex gap-2 overflow-x-auto min-h-[50px]">
                {suggestionsLoading ? (
                    <div className="text-xs text-muted-foreground flex items-center animate-pulse">
                        <span className="mr-2">✨</span> Generating suggestions...
                    </div>
                ) : (
                    suggestions.map((reply, i) => (
                        <button
                            key={i}
                            onClick={() => setNewMessage(reply)}
                            className="whitespace-nowrap px-3 py-1 rounded-full bg-purple-100 border border-purple-200 text-purple-700 text-xs hover:bg-purple-200 dark:bg-purple-900/20 dark:border-purple-800 dark:text-purple-300 transition-colors"
                        >
                            ✨ {reply}
                        </button>
                    ))
                )}
            </div>

            {/* Input Area */}
            <div className="p-4 border-t border-border bg-background/50">
                <div className="flex gap-4">
                    <input
                        type="text"
                        className="flex-1 bg-muted border border-border rounded-lg p-3 text-foreground focus:outline-none focus:ring-1 focus:ring-brand-500"
                        placeholder="Type a message..."
                        value={newMessage}
                        onChange={(e) => setNewMessage(e.target.value)}
                        onKeyDown={(e) => e.key === "Enter" && handleSend()}
                    />
                    <Button variant="default" onClick={handleSend}>Send</Button>
                </div>
            </div>
        </div>
    );
}
