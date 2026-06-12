"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Mail, Clock, Send, Headphones, Building2 } from "lucide-react";

export default function ContactPage() {
    const [form, setForm] = useState({ name: "", email: "", subject: "", message: "" });
    const [loading, setLoading] = useState(false);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);
        try {
            const response = await fetch("/api/support/contact", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(form),
            });
            const data = await response.json().catch(() => ({}));

            if (!response.ok) {
                const message = typeof data?.error === "string" ? data.error : "Failed to send message. Please try again.";
                throw new Error(message);
            }

            toast.success("Message sent. We'll get back to you as soon as we can.");
            setForm({ name: "", email: "", subject: "", message: "" });
        } catch (error) {
            const message = error instanceof Error ? error.message : "Failed to send message. Please try again.";
            toast.error(message);
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="min-h-screen bg-slate-950 text-white overflow-hidden">
            {/* Background */}
            <div className="absolute top-[-10%] right-[-10%] w-[40%] h-[40%] bg-indigo-600/10 rounded-full blur-[120px] pointer-events-none" />
            <div className="absolute bottom-[-10%] left-[-10%] w-[30%] h-[30%] bg-purple-600/10 rounded-full blur-[120px] pointer-events-none" />

            <div className="max-w-6xl mx-auto px-6 py-24 relative z-10 space-y-20">

                {/* Header */}
                <section className="text-center space-y-6">
                    <p className="text-sm uppercase tracking-widest text-indigo-400 font-semibold">Contact</p>
                    <h1 className="text-5xl md:text-6xl font-extrabold tracking-tight">
                        Yes, we are here.
                    </h1>
                    <p className="text-xl text-gray-400 max-w-2xl mx-auto leading-relaxed">
                        Tell us what is blocking you. We will help you move forward.
                    </p>
                </section>

                {/* Contact Methods + Form */}
                <div className="grid grid-cols-1 lg:grid-cols-5 gap-12">

                    {/* Contact Info */}
                    <div className="lg:col-span-2 space-y-6">
                        <h2 className="text-2xl font-bold mb-6">Quick channels</h2>

                        <div className="p-6 rounded-2xl bg-white/[0.02] border border-white/5 hover:border-indigo-500/20 transition-colors space-y-2">
                            <div className="flex items-center gap-3 text-indigo-400">
                                <Mail className="w-5 h-5" />
                                <span className="font-semibold">Email support</span>
                            </div>
                            <p className="text-gray-400 text-sm">General questions and account help</p>
                            <a href="mailto:support@craftmyfunnel.com" className="text-white font-medium hover:text-indigo-400 transition-colors">support@craftmyfunnel.com</a>
                        </div>

                        <div className="p-6 rounded-2xl bg-white/[0.02] border border-white/5 hover:border-purple-500/20 transition-colors space-y-2">
                            <div className="flex items-center gap-3 text-purple-400">
                                <Building2 className="w-5 h-5" />
                                <span className="font-semibold">Enterprise sales</span>
                            </div>
                            <p className="text-gray-400 text-sm">Custom plans, SSO, and rollout support</p>
                            <a href="mailto:enterprise@craftmyfunnel.com" className="text-white font-medium hover:text-purple-400 transition-colors">enterprise@craftmyfunnel.com</a>
                        </div>

                        <div className="p-6 rounded-2xl bg-white/[0.02] border border-white/5 hover:border-emerald-500/20 transition-colors space-y-2">
                            <div className="flex items-center gap-3 text-emerald-400">
                                <Headphones className="w-5 h-5" />
                                <span className="font-semibold">In-product help</span>
                            </div>
                            <p className="text-gray-400 text-sm">Use the floating help assistant anywhere in the app</p>
                            <p className="text-white font-medium">If you still need help, use this form.</p>
                        </div>

                        <div className="flex items-start gap-3 mt-6 text-gray-500 text-sm">
                            <Clock className="w-4 h-4 mt-0.5 shrink-0" />
                            <p>We will reply as soon as we can.</p>
                        </div>
                    </div>

                    {/* Contact Form */}
                    <div className="lg:col-span-3">
                        <div className="p-8 rounded-2xl bg-white/[0.02] border border-white/5 backdrop-blur-md">
                            <h2 className="text-2xl font-bold mb-2">Send a message</h2>
                            <p className="text-sm text-gray-500 mb-8">Short is fine. Tell us what happened and what you expected.</p>

                            <form onSubmit={handleSubmit} className="space-y-5">
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                                    <div>
                                        <label htmlFor="contact-name" className="block text-sm font-medium text-gray-300 mb-2">Your name</label>
                                        <input
                                            id="contact-name"
                                            type="text"
                                            required
                                            value={form.name}
                                            onChange={(e) => setForm({ ...form, name: e.target.value })}
                                            className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-indigo-500/50 focus:ring-2 focus:ring-indigo-500/20 transition-all placeholder:text-gray-600"
                                            placeholder="Jane Smith"
                                        />
                                    </div>
                                    <div>
                                        <label htmlFor="contact-email" className="block text-sm font-medium text-gray-300 mb-2">Work email</label>
                                        <input
                                            id="contact-email"
                                            type="email"
                                            required
                                            value={form.email}
                                            onChange={(e) => setForm({ ...form, email: e.target.value })}
                                            className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-indigo-500/50 focus:ring-2 focus:ring-indigo-500/20 transition-all placeholder:text-gray-600"
                                            placeholder="jane@company.com"
                                        />
                                    </div>
                                </div>

                                <div>
                                    <label htmlFor="contact-subject" className="block text-sm font-medium text-gray-300 mb-2">What do you need help with?</label>
                                    <select
                                        id="contact-subject"
                                        required
                                        title="Select a contact subject"
                                        value={form.subject}
                                        onChange={(e) => setForm({ ...form, subject: e.target.value })}
                                        className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-indigo-500/50 focus:ring-2 focus:ring-indigo-500/20 transition-all"
                                    >
                                        <option value="" className="bg-slate-900">Select a topic...</option>
                                        <option value="general" className="bg-slate-900">General question</option>
                                        <option value="support" className="bg-slate-900">Technical support</option>
                                        <option value="enterprise" className="bg-slate-900">Enterprise partnership</option>
                                        <option value="billing" className="bg-slate-900">Billing & plans</option>
                                        <option value="feature" className="bg-slate-900">Feature request</option>
                                    </select>
                                </div>

                                <div>
                                    <label htmlFor="contact-message" className="block text-sm font-medium text-gray-300 mb-2">Tell us what happened</label>
                                    <textarea
                                        id="contact-message"
                                        required
                                        rows={5}
                                        value={form.message}
                                        onChange={(e) => setForm({ ...form, message: e.target.value })}
                                        className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-indigo-500/50 focus:ring-2 focus:ring-indigo-500/20 transition-all placeholder:text-gray-600 resize-none"
                                        placeholder="Where were you, and what did you expect?"
                                    />
                                </div>

                                <button
                                    type="submit"
                                    disabled={loading}
                                    className="w-full bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 rounded-xl py-4 text-base font-bold transition-all shadow-lg shadow-indigo-500/20 hover:shadow-indigo-500/30 flex items-center justify-center gap-2 disabled:opacity-50"
                                >
                                    {loading ? "Sending..." : "Send message"}
                                    {!loading && <Send className="w-4 h-4" />}
                                </button>
                            </form>
                        </div>
                    </div>

                </div>
            </div>
        </div>
    );
}
