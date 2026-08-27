"use client";

import { useEffect, useMemo, useState } from "react";
import { getLandingRenderPayload } from "@/modules/landing-agent/rendering";
import { getBrowserApiBase } from "@/lib/api/browserBase";

interface Props {
    slug: string;
    title?: string | null;
    version: number;
    renderedJson: unknown;
}

const API_BASE = getBrowserApiBase();

function createSessionId() {
    return globalThis.crypto?.randomUUID?.() || `sess-${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

async function trackEvent(slug: string, payload: { eventName: string; eventData?: unknown; sessionId?: string; pageVersion?: number }) {
    await fetch(`${API_BASE}/landing-agent/public/${slug}/event`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
    }).catch(() => null);
}

export default function PublishedLandingRenderer({ slug, title, version, renderedJson }: Props) {
    const [submitting, setSubmitting] = useState(false);
    const [status, setStatus] = useState<string | null>(null);
    const [formStarted, setFormStarted] = useState(false);
    const sessionId = useMemo(createSessionId, []);
    const payload = useMemo(() => getLandingRenderPayload(renderedJson), [renderedJson]);

    useEffect(() => {
        trackEvent(slug, {
            eventName: "page_view",
            sessionId,
            pageVersion: version,
            eventData: { path: window.location.pathname },
        });
    }, [sessionId, slug, version]);

    return (
        <div className="la-page min-h-screen bg-slate-100 text-slate-900">
            <div className="mx-auto max-w-6xl px-4 py-8">
                {title ? <h1 className="mb-4 text-2xl font-semibold">{title}</h1> : null}
                <style>{payload.css}</style>
                <div dangerouslySetInnerHTML={{ __html: payload.html }} />

                <section className="mx-auto mt-10 max-w-2xl rounded-xl border border-slate-300 bg-white p-6 shadow-sm">
                    <span id="lead-form" className="block -translate-y-6" aria-hidden="true" />
                    <h2 className="text-xl font-semibold">Request a follow-up</h2>
                    <p className="mt-2 text-sm text-slate-600">
                        Share details and our team will reach out shortly.
                    </p>

                    <form
                        className="mt-4 grid gap-3"
                        onFocus={() => {
                            if (formStarted) return;
                            setFormStarted(true);
                            trackEvent(slug, {
                                eventName: "form_start",
                                sessionId,
                                pageVersion: version,
                            });
                        }}
                        onSubmit={async (e) => {
                            e.preventDefault();
                            setSubmitting(true);
                            setStatus(null);
                            const form = e.currentTarget;
                            const data = new FormData(form);
                            const url = new URL(window.location.href);
                            try {
                                const res = await fetch(`${API_BASE}/landing-agent/public/${slug}/lead`, {
                                    method: "POST",
                                    headers: { "Content-Type": "application/json" },
                                    body: JSON.stringify({
                                        sessionId,
                                        pageVersion: version,
                                        name: data.get("name") || undefined,
                                        email: data.get("email") || undefined,
                                        phone: data.get("phone") || undefined,
                                        company: data.get("company") || undefined,
                                        title: data.get("title") || undefined,
                                        website: data.get("website") || undefined,
                                        utmSource: url.searchParams.get("utm_source") || undefined,
                                        utmMedium: url.searchParams.get("utm_medium") || undefined,
                                        utmCampaign: url.searchParams.get("utm_campaign") || undefined,
                                        utmTerm: url.searchParams.get("utm_term") || undefined,
                                        utmContent: url.searchParams.get("utm_content") || undefined,
                                        referrer: document.referrer || undefined,
                                    }),
                                });
                                if (!res.ok) {
                                    const payload = await res.json().catch(() => null);
                                    throw new Error(payload?.error || "Submission failed");
                                }
                                await trackEvent(slug, {
                                    eventName: "cta_click",
                                    sessionId,
                                    pageVersion: version,
                                    eventData: { cta: "form_submit" },
                                });
                                window.location.href = `/p/${slug}/thank-you`;
                            } catch {
                                setStatus("Submission failed. Please try again.");
                            } finally {
                                setSubmitting(false);
                            }
                        }}
                    >
                        <input type="text" name="name" placeholder="Name" className="rounded-md border border-slate-300 px-3 py-2" />
                        <input type="email" name="email" placeholder="Work email" required className="rounded-md border border-slate-300 px-3 py-2" />
                        <input type="text" name="phone" placeholder="Phone" className="rounded-md border border-slate-300 px-3 py-2" />
                        <input type="text" name="company" placeholder="Company" className="rounded-md border border-slate-300 px-3 py-2" />
                        <input type="text" name="title" placeholder="Title" className="rounded-md border border-slate-300 px-3 py-2" />
                        <input type="text" name="website" tabIndex={-1} autoComplete="off" className="hidden" />
                        <button
                            type="submit"
                            disabled={submitting}
                            className="rounded-md bg-cyan-600 px-4 py-2 font-medium text-white hover:bg-cyan-500 disabled:opacity-60"
                        >
                            {submitting ? "Submitting..." : "Submit"}
                        </button>
                    </form>

                    {status ? <p className="mt-3 text-sm text-rose-600">{status}</p> : null}
                </section>
            </div>
        </div>
    );
}
