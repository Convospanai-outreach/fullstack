"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";

// Connects the CraftMyFunnel LinkedIn extension to the signed-in account. The extension opens
// this page with a one-time code in the path (the login redirect keeps the path, not the query).
// On the user's click we mint an extension token and hand it, with that code, to the extension's
// script on this page only; the extension accepts it only if the code is the one it issued.
// Signed-out visitors are sent to /login by proxy.ts and come back here.

type Status = "idle" | "working" | "done" | "error" | "no-extension";

const STATE_RE = /^[A-Za-z0-9-]{16,64}$/;

export default function ConnectExtensionPage() {
    const params = useParams<{ state: string }>();
    const state = typeof params?.state === "string" && STATE_RE.test(params.state) ? params.state : null;
    const [status, setStatus] = useState<Status>("idle");
    const [message, setMessage] = useState("");
    const [extensionSeen, setExtensionSeen] = useState(false);

    useEffect(() => {
        const onMessage = (e: MessageEvent) => {
            if (e.source !== window || e.origin !== window.location.origin) return;
            const d = e.data;
            if (d?.source !== "cmf-extension") return;
            if (d.type === "PRESENT") setExtensionSeen(true);
            if (d.type === "CONNECTED") {
                setStatus(d.ok ? "done" : "error");
                setMessage(d.ok ? "" : String(d.error || "The extension could not connect."));
            }
        };
        window.addEventListener("message", onMessage);
        window.postMessage({ source: "cmf-connect", type: "HELLO" }, window.location.origin);
        return () => window.removeEventListener("message", onMessage);
    }, []);

    async function connect() {
        if (!state) return;
        setStatus("working");
        setMessage("");
        try {
            const res = await fetch("/api/extension/token", { method: "POST" });
            const data = await res.json().catch(() => ({}));
            if (!res.ok || !data.ok || !data.token) throw new Error(data.error || "Could not create a sign-in for the extension.");
            window.postMessage({ source: "cmf-connect", type: "PAGE_LOGIN", token: data.token, state }, window.location.origin);
            // If the extension never answers, it isn't installed or this tab predates it.
            setTimeout(() => setStatus((s) => (s === "working" ? "no-extension" : s)), 8000);
        } catch (err: any) {
            setStatus("error");
            setMessage(err?.message || "Something went wrong.");
        }
    }

    return (
        <main className="mx-auto flex min-h-[70vh] max-w-lg flex-col justify-center gap-5 px-6 py-16">
            <h1 className="text-2xl font-semibold">Connect the CraftMyFunnel extension</h1>
            {!state ? (
                <p className="text-sm text-red-600">
                    This link is incomplete. Open the extension and click &quot;Sign in with CraftMyFunnel&quot; again.
                </p>
            ) : status === "done" ? (
                <p className="text-sm">The extension is connected. You can close this tab and go back to LinkedIn.</p>
            ) : (
                <>
                    <p className="text-sm text-slate-600">
                        The extension will use your CraftMyFunnel account and plan. It drafts comments, notes and
                        messages for you to review; nothing is sent on LinkedIn until you press Send yourself.
                    </p>
                    <button
                        type="button"
                        onClick={connect}
                        disabled={status === "working"}
                        className="rounded-md bg-slate-900 px-4 py-2 text-sm font-medium text-white disabled:opacity-60"
                    >
                        {status === "working" ? "Connecting..." : "Connect the extension"}
                    </button>
                    {status === "no-extension" && (
                        <p className="text-sm text-amber-700">
                            {extensionSeen
                                ? "The extension did not answer. Start sign-in from the extension again."
                                : "The extension was not found on this page. Install or reload it, then start sign-in from the extension."}
                        </p>
                    )}
                    {status === "error" && <p className="text-sm text-red-600">{message}</p>}
                </>
            )}
        </main>
    );
}
