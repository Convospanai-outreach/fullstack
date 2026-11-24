"use client";

import { useEffect, Suspense } from "react";
import { usePathname, useSearchParams } from "next/navigation";

/**
 * Dispatches custom events to Google Analytics (GA4) with type safety and fallback.
 */
export function trackCustomEvent(eventName: string, params?: Record<string, any>) {
  if (typeof window !== "undefined") {
    const win = window as any;
    if (typeof win.gtag === "function") {
      win.gtag("event", eventName, params);
    }
  }
}

function GoogleAnalyticsRouteTracker({ measurementId }: { measurementId: string }) {
  const pathname = usePathname();
  const searchParams = useSearchParams();

  useEffect(() => {
    if (!measurementId || typeof window === "undefined") {
      return;
    }

    const win = window as any;
    if (typeof win.gtag !== "function") {
      return;
    }

    const url = searchParams?.toString()
      ? `${pathname}?${searchParams.toString()}`
      : pathname;

    win.gtag("config", measurementId, {
      page_path: url,
    });
  }, [pathname, searchParams, measurementId]);

  return null;
}

export function GoogleAnalytics() {
  const measurementId =
    process.env["NEXT_PUBLIC_GA_MEASUREMENT_ID"] ||
    process.env["NEXT_PUBLIC_GA_ID"] ||
    "G-PJCWLF4HVJ";

  return (
    <Suspense fallback={null}>
      <GoogleAnalyticsRouteTracker measurementId={measurementId} />
    </Suspense>
  );
}
