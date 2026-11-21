"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Page, PageHero } from "@/components/marketing/site/kit";
import { trackCustomEvent } from "@/components/analytics/GoogleAnalytics";
import TurnstileWidget from "@/components/auth/TurnstileWidget";


export default function ContactPage() {
    const [form, setForm] = useState({ name: "", email: "", subject: "", message: "", website_url: "" });
    const [loading, setLoading] = useState(false);
    const [turnstileToken, setTurnstileToken] = useState("");
    // A Turnstile token is single-use; remounting the widget after each attempt gets a fresh one.
    const [widgetKey, setWidgetKey] = useState(0);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);
        try {
            // Extract GA4 client_id from _ga cookie if available
            let gaClientId = "";
            if (typeof document !== "undefined") {
                const gaCookie = document.cookie.split('; ').find(row => row.startsWith('_ga='));
                if (gaCookie) {
                    const parts = gaCookie.split('.');
                    if (parts.length >= 4) {
                        gaClientId = `${parts[2]}.${parts[3]}`;
                    }
                }
            }

            const response = await fetch("/api/support/contact", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    ...form,
                    ga_client_id: gaClientId,
                    turnstileToken,
                }),
            });
            const data = await response.json().catch(() => ({}));

            if (!response.ok) {
                const message = typeof data?.error === "string" ? data.error : "Failed to send message. Please try again.";
                throw new Error(message);
            }

            if (data?.delivery === "queued" || data?.status === "queued") {
                throw new Error("Your message could not be delivered. Please email contact.us@craftmyfunnel.live.");
            }

            // Fire standard GA4 Lead Conversion Event
            trackCustomEvent("generate_lead", {
                currency: "USD",
                value: 49,
                event_category: "Lead Capture",
                event_label: form.subject || "General Inquiry",
                form_source: "Contact Page",
            });

            toast.success("Message sent. We'll get back to you as soon as we can.");
            setForm({ name: "", email: "", subject: "", message: "", website_url: "" });
        } catch (error) {
            const message = error instanceof Error ? error.message : "Failed to send message. Please try again.";
            toast.error(message);
        } finally {
            setTurnstileToken("");
            setWidgetKey((key) => key + 1);
            setLoading(false);
        }
    };


    return (
        <Page>
            <PageHero eyebrow="Contact" title="Talk to an expert." lead="Planning a pilot, comparing tools or stuck on setup? Tell us what you need and the right person will reply." />
            <section className="ph-section ph-light">
                <div className="ph-wrap ph-split">
                    <div>
                        <h2>Ways to reach us</h2>
                        <div className="ph-grid ph-grid-2" style={{ marginTop: 24 }}>
                            <article className="ph-card"><p className="ph-label">Sales & pilots</p><h3>Start with one service and one market.</h3><a href="mailto:contact.us@craftmyfunnel.live">contact.us@craftmyfunnel.live</a></article>
                            <article className="ph-card"><p className="ph-label">Support</p><h3>Setup, mailboxes, billing.</h3><a href="/help">Help Center</a></article>
                        </div>
                        <p className="ph-source">Operated by Sudhisha Digital Private Limited, India. Serving India, the US and Europe.</p>
                    </div>
                    <div className="ph-card" style={{ background: "#fff", padding: 36 }}>
                        <h3>Send a message</h3>
                        <p style={{ color: "var(--ph-muted)", marginBottom: 24 }}>Short is fine.</p>
                        <form onSubmit={handleSubmit} className="space-y-5">
                            <div className="hidden" aria-hidden="true" style={{ display: "none" }}>
                                <label htmlFor="contact-website-url">Website</label>
                                <input id="contact-website-url" type="text" tabIndex={-1} autoComplete="off" value={form.website_url} onChange={(e) => setForm({ ...form, website_url: e.target.value })} />
                            </div>
                            <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
                                <div>
                                    <label htmlFor="contact-name" className="mb-2 block text-sm font-semibold text-[#0c1b30]">Your name</label>
                                    <input id="contact-name" type="text" required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} className="w-full rounded-xl border border-[#0c1b30]/20 bg-white px-4 py-3 text-[#0c1b30] placeholder:text-[#0c1b30]/40 focus:border-[#006a9a] focus:outline-none focus:ring-2 focus:ring-[#006a9a]/20" placeholder="Jane Smith" />
                                </div>
                                <div>
                                    <label htmlFor="contact-email" className="mb-2 block text-sm font-semibold text-[#0c1b30]">Work email</label>
                                    <input id="contact-email" type="email" required value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} className="w-full rounded-xl border border-[#0c1b30]/20 bg-white px-4 py-3 text-[#0c1b30] placeholder:text-[#0c1b30]/40 focus:border-[#006a9a] focus:outline-none focus:ring-2 focus:ring-[#006a9a]/20" placeholder="jane@company.com" />
                                </div>
                            </div>
                            <div>
                                <label htmlFor="contact-subject" className="mb-2 block text-sm font-semibold text-[#0c1b30]">What do you need?</label>
                                <select id="contact-subject" required title="Select a contact subject" value={form.subject} onChange={(e) => setForm({ ...form, subject: e.target.value })} className="w-full rounded-xl border border-[#0c1b30]/20 bg-white px-4 py-3 text-[#0c1b30] placeholder:text-[#0c1b30]/40 focus:border-[#006a9a] focus:outline-none focus:ring-2 focus:ring-[#006a9a]/20">
                                    <option value="">Select a topic...</option>
                                    <option value="enterprise">Start a pilot / talk to sales</option>
                                    <option value="general">General question</option>
                                    <option value="support">Technical support</option>
                                    <option value="billing">Billing & plans</option>
                                    <option value="feature">Feature request</option>
                                </select>
                            </div>
                            <div>
                                <label htmlFor="contact-message" className="mb-2 block text-sm font-semibold text-[#0c1b30]">Your message</label>
                                <textarea id="contact-message" required rows={5} value={form.message} onChange={(e) => setForm({ ...form, message: e.target.value })} className="w-full rounded-xl border border-[#0c1b30]/20 bg-white px-4 py-3 text-[#0c1b30] placeholder:text-[#0c1b30]/40 focus:border-[#006a9a] focus:outline-none focus:ring-2 focus:ring-[#006a9a]/20" placeholder="Your industry, market and what you'd like to achieve." />
                            </div>
                            <TurnstileWidget key={widgetKey} onToken={setTurnstileToken} />
                            <button type="submit" disabled={loading} className="ph-btn ph-btn-yellow" style={{ width: "100%" }}>
                                {loading ? "Sending..." : "Send message"}
                            </button>
                        </form>
                    </div>
                </div>
            </section>
        </Page>
    );
}
