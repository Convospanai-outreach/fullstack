"use client";

import { useEffect, useRef } from "react";

declare global {
    interface Window {
        turnstile?: {
            render: (el: HTMLElement, opts: { sitekey: string; callback: (token: string) => void; "expired-callback": () => void }) => string;
            remove: (id: string) => void;
        };
    }
}

const SCRIPT_SRC = "https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit";

// Renders nothing unless NEXT_PUBLIC_TURNSTILE_SITE_KEY is set, matching the
// server, which only enforces the check when TURNSTILE_SECRET_KEY is set.
export default function TurnstileWidget({ onToken }: { onToken: (token: string) => void }) {
    const siteKey = process.env["NEXT_PUBLIC_TURNSTILE_SITE_KEY"];
    const container = useRef<HTMLDivElement>(null);

    useEffect(() => {
        if (!siteKey || !container.current) return;
        const el = container.current;
        let widgetId: string | undefined;

        const mount = () => {
            if (!window.turnstile || widgetId) return;
            widgetId = window.turnstile.render(el, {
                sitekey: siteKey,
                callback: onToken,
                "expired-callback": () => onToken(""),
            });
        };

        let script = document.querySelector<HTMLScriptElement>(`script[src="${SCRIPT_SRC}"]`);
        if (!script) {
            script = document.createElement("script");
            script.src = SCRIPT_SRC;
            script.async = true;
            document.head.appendChild(script);
        }
        if (window.turnstile) mount();
        else script.addEventListener("load", mount);

        return () => {
            script?.removeEventListener("load", mount);
            if (widgetId) window.turnstile?.remove(widgetId);
        };
    }, [siteKey, onToken]);

    return siteKey ? <div ref={container} className="flex justify-center" /> : null;
}
