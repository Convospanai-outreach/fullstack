type AnalyticsProperties = Record<string, unknown>;

declare global {
    interface Window {
        gtag?: (command: "event", eventName: string, properties?: AnalyticsProperties) => void;
    }
}

function trackEvent(eventName: string, properties?: AnalyticsProperties) {
    if (typeof window === "undefined") return;

    (window as unknown as { posthog?: { capture?: (event: string, properties?: AnalyticsProperties) => void } })
        .posthog?.capture?.(eventName, properties);
    window.gtag?.("event", eventName, properties);
}

export function cta_clicked(properties?: AnalyticsProperties) {
    trackEvent("cta_clicked", properties);
}

export function demo_requested(properties?: AnalyticsProperties) {
    trackEvent("demo_requested", properties);
}

export function pricing_viewed(properties?: AnalyticsProperties) {
    trackEvent("pricing_viewed", properties);
}

export function lead_form_started(properties?: AnalyticsProperties) {
    trackEvent("lead_form_started", properties);
}

export function lead_form_submitted(properties?: AnalyticsProperties) {
    trackEvent("lead_form_submitted", properties);
}

export function blog_viewed(properties?: AnalyticsProperties) {
    trackEvent("blog_viewed", properties);
}

export function case_study_viewed(properties?: AnalyticsProperties) {
    trackEvent("case_study_viewed", properties);
}
