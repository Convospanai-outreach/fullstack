import * as Sentry from "@sentry/nextjs";

// Client-side Sentry entry point. Next 16 loads this file automatically in the
// browser bundle (the successor to the legacy sentry.client.config.ts). It stays
// a no-op until NEXT_PUBLIC_SENTRY_DSN is set: Sentry.init with an absent dsn
// disables the SDK, so wiring this up cannot change behaviour before the owner
// provisions a DSN.
const dsn = process.env["NEXT_PUBLIC_SENTRY_DSN"];

Sentry.init({
    ...(dsn ? { dsn } : {}),

    tracesSampleRate: process.env.NODE_ENV === "production" ? 0.1 : 1.0,
    debug: false,

    replaysOnErrorSampleRate: 1.0,
    replaysSessionSampleRate: 0.1,
    integrations: [
        Sentry.replayIntegration({
            maskAllText: true,
            blockAllMedia: true,
        }),
    ],

    environment: process.env.NODE_ENV || "development",

    ignoreErrors: [
        // Browser extensions
        "top.GLOBALS",
        // Random plugins/extensions
        "originalCreateNotification",
        "canvas.contentDocument",
        "MyApp_RemoveAllHighlights",
        // Network errors
        "NetworkError",
        "Non-Error promise rejection captured",
    ],

    beforeSend(event) {
        // Don't send events in development.
        if (process.env.NODE_ENV === "development") {
            return null;
        }
        return event;
    },
});

// Instruments client-side navigations so Sentry traces route transitions.
export const onRouterTransitionStart = Sentry.captureRouterTransitionStart;
