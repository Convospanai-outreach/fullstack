"use client";

import React, { useState } from "react";
import { GlassCard } from "@/components/ui/GlassCard";
import { Button } from "@/components/ui/button";

export function ContactSupportForm() {
    const [formData, setFormData] = useState({
        name: "",
        email: "",
        subject: "",
        message: ""
    });
    const [loading, setLoading] = useState(false);
    const [success, setSuccess] = useState(false);
    const [statusMessage, setStatusMessage] = useState("Message sent successfully. We'll get back to you shortly.");
    const [ticketId, setTicketId] = useState<string>("");
    const [ticketStatus, setTicketStatus] = useState<string>("");
    const [errorMessage, setErrorMessage] = useState<string | null>(null);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);
        setErrorMessage(null);
        setTicketId("");
        setTicketStatus("");
        try {
            const res = await fetch("/api/support/contact", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(formData)
            });
            const data = await res.json().catch(() => ({}));

            if (res.ok) {
                setStatusMessage(
                    typeof data?.message === "string" && data.message.length > 0
                        ? data.message
                        : "Message sent successfully. We'll get back to you shortly."
                );
                setTicketId(typeof data?.ticketId === "string" ? data.ticketId : "");
                setTicketStatus(typeof data?.status === "string" ? data.status : "submitted");
                setSuccess(true);
                setFormData({ name: "", email: "", subject: "", message: "" });
                setTimeout(() => setSuccess(false), 5000);
            } else {
                setSuccess(false);
                setErrorMessage(
                    typeof data?.error === "string" && data.error.length > 0
                        ? data.error
                        : "Failed to send message. Please try again."
                );
            }
        } catch (error) {
            console.error(error);
            setSuccess(false);
            setErrorMessage("An unexpected error occurred. Please try again.");
        }
        setLoading(false);
    };

    return (
        <GlassCard>
            <h3 className="text-xl font-bold gradient-text mb-6">Contact Support</h3>
            {success ? (
                <div className="p-4 bg-green-500/20 border border-green-500/50 rounded-lg text-green-200 text-center">
                    <p>{statusMessage}</p>
                    {ticketId ? (
                        <p className="mt-2 text-xs text-green-100/90">
                            Ticket ID: <span className="font-semibold">{ticketId}</span> | Status:{" "}
                            <span className="font-semibold uppercase">{ticketStatus || "submitted"}</span>
                        </p>
                    ) : null}
                </div>
            ) : (
                <form onSubmit={handleSubmit} className="space-y-4">
                    {errorMessage ? (
                        <div className="rounded-lg border border-red-500/40 bg-red-500/10 p-3 text-sm text-red-200">
                            {errorMessage}
                        </div>
                    ) : null}
                    <div>
                        <label htmlFor="support-name" className="block text-sm text-gray-400 mb-1">Name</label>
                        <input
                            id="support-name"
                            type="text"
                            className="w-full bg-white/5 border border-white/10 rounded-lg p-3 text-white focus:outline-none focus:border-blue-500"
                            value={formData.name}
                            onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                            required
                        />
                    </div>
                    <div>
                        <label htmlFor="support-email" className="block text-sm text-gray-400 mb-1">Email</label>
                        <input
                            id="support-email"
                            type="email"
                            className="w-full bg-white/5 border border-white/10 rounded-lg p-3 text-white focus:outline-none focus:border-blue-500"
                            value={formData.email}
                            onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                            required
                        />
                    </div>
                    <div>
                        <label htmlFor="support-subject" className="block text-sm text-gray-400 mb-1">Subject</label>
                        <input
                            id="support-subject"
                            type="text"
                            className="w-full bg-white/5 border border-white/10 rounded-lg p-3 text-white focus:outline-none focus:border-blue-500"
                            value={formData.subject}
                            onChange={(e) => setFormData({ ...formData, subject: e.target.value })}
                            required
                        />
                    </div>
                    <div>
                        <label htmlFor="support-message" className="block text-sm text-gray-400 mb-1">Message</label>
                        <textarea
                            id="support-message"
                            className="w-full bg-white/5 border border-white/10 rounded-lg p-3 text-white focus:outline-none focus:border-blue-500 min-h-[120px]"
                            value={formData.message}
                            onChange={(e) => setFormData({ ...formData, message: e.target.value })}
                            required
                        />
                    </div>
                    <Button variant="default" disabled={loading} className="w-full">
                        {loading ? "Sending..." : "Send Message"}
                    </Button>
                </form>
            )}
        </GlassCard>
    );
}
