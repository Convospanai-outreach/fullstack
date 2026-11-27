"use client";

import { useRef, useState } from "react";
import TurnstileWidget from "@/components/auth/TurnstileWidget";

const FIELD = "w-full rounded-lg border bg-background p-2.5 text-sm";

export function ApplyForm({ jobSlug }: { jobSlug: string }) {
    const startedAt = useRef(Date.now());
    const [token, setToken] = useState("");
    const [widgetKey, setWidgetKey] = useState(0);
    const [sending, setSending] = useState(false);
    const [done, setDone] = useState(false);
    const [error, setError] = useState("");

    async function submit(event: React.FormEvent<HTMLFormElement>) {
        event.preventDefault();
        setSending(true);
        setError("");
        const data = new FormData(event.currentTarget);
        data.set("jobSlug", jobSlug);
        data.set("elapsedMs", String(Date.now() - startedAt.current));
        data.set("turnstileToken", token);
        try {
            const response = await fetch("/api/careers/apply", { method: "POST", body: data });
            const body = await response.json().catch(() => ({}));
            if (!response.ok) throw new Error(typeof body?.error === "string" ? body.error : "Could not submit your application.");
            setDone(true);
        } catch (e) {
            setError(e instanceof Error ? e.message : "Could not submit your application.");
        } finally {
            // A Turnstile token is single-use; remounting the widget gets a fresh one.
            setToken("");
            setWidgetKey((key) => key + 1);
            setSending(false);
        }
    }

    if (done) {
        return <p className="rounded-lg border bg-card p-4 text-sm">Thank you. We have your application and will be in touch if it is a fit.</p>;
    }

    return (
        <form onSubmit={submit} className="space-y-4">
            <label className="block text-sm font-medium">
                Full name
                <input name="name" required maxLength={120} className={FIELD} autoComplete="name" />
            </label>
            <label className="block text-sm font-medium">
                Email
                <input name="email" type="email" required maxLength={254} className={FIELD} autoComplete="email" />
            </label>
            <label className="block text-sm font-medium">
                Phone (optional)
                <input name="phone" maxLength={40} className={FIELD} autoComplete="tel" />
            </label>
            <label className="block text-sm font-medium">
                Note (optional)
                <textarea name="coverNote" rows={5} maxLength={4000} className={FIELD} />
            </label>
            <label className="block text-sm font-medium">
                Resume (PDF, DOC or DOCX, up to 2MB)
                <input name="resume" type="file" required accept=".pdf,.doc,.docx" className={FIELD} />
            </label>
            {/* Honeypot: people never see or fill this. */}
            <input name="website" tabIndex={-1} autoComplete="off" aria-hidden="true" className="hidden" />
            <TurnstileWidget key={widgetKey} onToken={setToken} />
            {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
            <button type="submit" disabled={sending} className="rounded-lg bg-primary px-5 py-2.5 text-sm font-semibold text-primary-foreground disabled:opacity-60">
                {sending ? "Sending..." : "Submit application"}
            </button>
        </form>
    );
}
