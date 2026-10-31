"use client";

import { useEffect, useMemo, useState } from "react";
import { getLandingRenderPayload } from "@/modules/landing-agent/rendering";
import { getBrowserApiBase } from "@/lib/api/browserBase";
import { readUtm } from "@/lib/utm";
import { hasLeadFormMarker, replaceLeadFormMarkers } from "@/modules/landing-agent/leadFormHtml";

interface Props {
    slug: string;
    title?: string | null;
    version: number;
    renderedJson: unknown;
    // Creator funnel pages: the WhatsApp opt-in checkbox text from the API, or null for none.
    whatsappOptIn?: string | null;
}

const API_BASE = getBrowserApiBase();

function createSessionId() {
    return globalThis.crypto?.randomUUID?.() || `sess-${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

async function trackEvent(slug: string, payload: { eventName: string; eventData?: unknown; sessionId?: string; pageVersion?: number }) {
    // The page URL's UTM goes with every event, so visits can be traced to the post/DM/email (attribution).
    const utm = readUtm(new URL(window.location.href).searchParams);
    await fetch(`${API_BASE}/landing-agent/public/${slug}/event`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...payload, ...utm }),
    }).catch(() => null);
}

// Pages with a lead form marker render a form built from the saved config (see leadFormHtml.ts).
// Its events are handled here on the wrapper div; anything that is not a marker form is ignored.
function customFormOf(target: EventTarget | null): HTMLFormElement | null {
    const form = target instanceof Element ? target.closest("form") : null;
    return form instanceof HTMLFormElement && form.hasAttribute("data-cmf-form") ? form : null;
}

export default function PublishedLandingRenderer({ slug, title, version, renderedJson, whatsappOptIn }: Props) {
    const [submitting, setSubmitting] = useState(false);
    const [status, setStatus] = useState<string | null>(null);
    const [formStarted, setFormStarted] = useState(false);
    const sessionId = useMemo(createSessionId, []);
    const payload = useMemo(() => getLandingRenderPayload(renderedJson), [renderedJson]);
    const leadHtml = useMemo(
        () => (hasLeadFormMarker(payload.html) ? replaceLeadFormMarkers(payload.html, { slug, whatsappOptIn: whatsappOptIn ?? null }) : null),
        [payload.html, slug, whatsappOptIn]
    );

    async function submitCustomLeadForm(form: HTMLFormElement) {
        const status = form.ownerDocument.getElementById("la-lead-form-status");
        const button = form.querySelector("button[type=submit]") as HTMLButtonElement | null;
        if (button) button.disabled = true;
        if (status) status.textContent = "";
        const data = new FormData(form);
        const formFields: Record<string, string | boolean> = {};
        for (const el of Array.from(form.querySelectorAll("input, select, textarea"))) {
            const field = el as HTMLInputElement;
            if (!field.name || field.name === "website" || field.name === "whatsappConsent") continue;
            formFields[field.name] = field.type === "checkbox" ? field.checked : field.value;
        }
        const url = new URL(window.location.href);
        try {
            const res = await fetch(`${API_BASE}/landing-agent/public/${slug}/lead`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    sessionId,
                    pageVersion: version,
                    formFields,
                    website: data.get("website") || undefined,
                    utmSource: url.searchParams.get("utm_source") || undefined,
                    utmMedium: url.searchParams.get("utm_medium") || undefined,
                    utmCampaign: url.searchParams.get("utm_campaign") || undefined,
                    utmTerm: url.searchParams.get("utm_term") || undefined,
                    utmContent: url.searchParams.get("utm_content") || undefined,
                    referrer: document.referrer || undefined,
                    socialToken: url.searchParams.get("t") || undefined,
                    whatsappConsent: data.get("whatsappConsent") === "on" || undefined,
                }),
            });
            if (!res.ok) throw new Error("Submission failed");
            await trackEvent(slug, { eventName: "cta_click", sessionId, pageVersion: version, eventData: { cta: "form_submit" } });
            window.location.href = form.getAttribute("data-redirect") || `/p/${slug}/thank-you`;
        } catch {
            if (status) status.textContent = "Submission failed. Please try again.";
            if (button) button.disabled = false;
        }
    }

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
                <div
                    onFocus={(e) => {
                        if (!customFormOf(e.target) || formStarted) return;
                        setFormStarted(true);
                        trackEvent(slug, { eventName: "form_start", sessionId, pageVersion: version });
                    }}
                    onSubmit={(e) => {
                        const form = customFormOf(e.target);
                        if (!form) return;
                        e.preventDefault();
                        void submitCustomLeadForm(form);
                    }}
                    dangerouslySetInnerHTML={{ __html: leadHtml ?? payload.html }}
                />

                {leadHtml === null ? (
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
                                        // Creator funnel: the signed ?t= from an auto-reply link, so the
                                        // sign-up merges into the lead that got it.
                                        socialToken: url.searchParams.get("t") || undefined,
                                        whatsappConsent: data.get("whatsappConsent") === "on" || undefined,
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
                        {whatsappOptIn ? (
                            <label className="flex items-start gap-2 text-sm text-slate-700">
                                <input type="checkbox" name="whatsappConsent" className="mt-1" />
                                {whatsappOptIn}
                            </label>
                        ) : null}
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
                ) : null}
            </div>
        </div>
    );
}
