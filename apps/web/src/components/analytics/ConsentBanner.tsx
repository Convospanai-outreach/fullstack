"use client";

import { useEffect, useState } from "react";

const STORAGE_KEY = "cmf_analytics_consent";
type Choice = "granted" | "denied";

function readChoice(): Choice | null {
  try {
    const value = window.localStorage.getItem(STORAGE_KEY);
    return value === "granted" || value === "denied" ? value : null;
  } catch {
    return null;
  }
}

function loadGoogleAnalytics(measurementId: string) {
  const win = window as any;
  if (typeof win.gtag === "function") return;
  win.dataLayer = win.dataLayer || [];
  win.gtag = function gtag() {
    // gtag.js requires the Arguments object, not an array.
    // eslint-disable-next-line prefer-rest-params
    win.dataLayer.push(arguments);
  };
  const script = document.createElement("script");
  script.async = true;
  script.src = `https://www.googletagmanager.com/gtag/js?id=${measurementId}`;
  script.setAttribute("data-cfasync", "false");
  document.head.appendChild(script);
  win.gtag("js", new Date());
  win.gtag("config", measurementId, { send_page_view: true });
}

function revokeGoogleAnalytics(measurementId: string) {
  const win = window as any;
  win[`ga-disable-${measurementId}`] = true;
  const host = window.location.hostname;
  const domains = [host, `.${host}`, `.${host.split(".").slice(-2).join(".")}`];
  for (const name of document.cookie.split("; ").map((c) => c.split("=")[0])) {
    if (name === "_ga" || name?.startsWith("_ga_") || name === "_gid") {
      for (const domain of domains) {
        document.cookie = `${name}=; expires=Thu, 01 Jan 1970 00:00:00 GMT; path=/; domain=${domain}`;
      }
      document.cookie = `${name}=; expires=Thu, 01 Jan 1970 00:00:00 GMT; path=/`;
    }
  }
}

function applyChoice(choice: Choice, measurementId: string) {
  const posthog = (window as any).posthog;
  if (choice === "granted") {
    (window as any)[`ga-disable-${measurementId}`] = false;
    loadGoogleAnalytics(measurementId);
    posthog?.opt_in_capturing?.();
  } else {
    revokeGoogleAnalytics(measurementId);
    posthog?.opt_out_capturing?.();
  }
}

export function ConsentBanner({ measurementId }: { measurementId: string }) {
  const [choice, setChoice] = useState<Choice | null>(null);
  const [open, setOpen] = useState(false);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const stored = readChoice();
    setChoice(stored);
    setOpen(stored === null);
    setReady(true);
    if (stored) applyChoice(stored, measurementId);
  }, [measurementId]);

  const decide = (next: Choice) => {
    try {
      window.localStorage.setItem(STORAGE_KEY, next);
    } catch {
      // Choice still applies for this page view when storage is blocked.
    }
    setChoice(next);
    setOpen(false);
    applyChoice(next, measurementId);
  };

  if (!ready) return null;

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="fixed bottom-2 left-2 z-[90] rounded-md bg-slate-900/80 px-2 py-1 text-xs text-slate-300 underline hover:text-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-indigo-400"
      >
        Cookie settings
      </button>
    );
  }

  return (
    <div
      role="dialog"
      aria-label="Analytics cookie preferences"
      className="fixed inset-x-3 bottom-3 z-[100] mx-auto max-w-xl rounded-xl border border-slate-700 bg-slate-900 p-4 text-sm text-slate-200 shadow-2xl"
    >
      <p>
        We use analytics cookies to understand how the site is used. They stay off unless you accept.
        {choice ? ` Current choice: ${choice === "granted" ? "accepted" : "rejected"}.` : ""}{" "}
        <a href="/privacy" className="underline">Privacy policy</a>
      </p>
      <div className="mt-3 flex gap-2">
        <button
          type="button"
          onClick={() => decide("denied")}
          className="rounded-lg border border-slate-600 px-3 py-1.5 font-medium hover:bg-slate-800 focus-visible:outline focus-visible:outline-2 focus-visible:outline-indigo-400"
        >
          Reject
        </button>
        <button
          type="button"
          onClick={() => decide("granted")}
          className="rounded-lg bg-indigo-500 px-3 py-1.5 font-medium text-white hover:bg-indigo-400 focus-visible:outline focus-visible:outline-2 focus-visible:outline-indigo-300"
        >
          Accept
        </button>
      </div>
    </div>
  );
}
