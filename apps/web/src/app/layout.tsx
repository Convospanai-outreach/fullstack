import "./globals.css";
import { Providers } from "./providers";
import { ErrorBoundary } from "@/components/ErrorBoundary";
import { LayoutShell } from "@/components/layout/LayoutShell";
import { SupportAssistant } from "@/components/support/SupportAssistant";
import Script from "next/script";
import { ClerkProvider } from "@clerk/nextjs";

export const metadata = {
  metadataBase: new URL(process.env["NEXTAUTH_URL"] || "http://localhost:3000"),
  title: "CraftMyFunnel — Governed Funnel Workflows for B2B Service Teams",
  description: "CraftMyFunnel helps B2B service teams manage buyer signals, approved outreach, follow-ups, and qualified meeting tracking.",
  keywords: "governed funnel workflows, qualified meetings, buyer intent, approved outreach, B2B service companies, vertical playbooks",
  icons: {
    icon: "/craftmyfunnel-logo.png",
    apple: "/craftmyfunnel-logo.png",
  },
  openGraph: {
    title: "CraftMyFunnel — Governed Funnel Workflows",
    description: "Manage buyer signals, approved outreach, follow-ups, and qualified meetings in one governed workflow.",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "CraftMyFunnel — Governed Funnel Workflows",
    description: "Manage buyer signals, approved outreach, follow-ups, and qualified meetings in one governed workflow.",
  },
  verification: {
    google: process.env["NEXT_PUBLIC_GOOGLE_SITE_VERIFICATION"] || undefined,
  },
};

import { Toaster } from "sonner";
import { CommandPalette } from "@/components/ui/CommandPalette";

export default function RootLayout({ children }: { children: React.ReactNode }) {
  const gaId = process.env["NEXT_PUBLIC_GA_ID"];
  const posthogKey = process.env["NEXT_PUBLIC_POSTHOG_KEY"];
  const posthogHost = process.env["NEXT_PUBLIC_POSTHOG_HOST"] || "https://us.i.posthog.com";
  const clerkPublishableKey = process.env["NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY"];
  const app = (
    <ErrorBoundary>
      <Providers>
        <CommandPalette />
        <Toaster position="top-center" richColors />
        <LayoutShell>
          {children}
        </LayoutShell>
        <SupportAssistant />
      </Providers>
    </ErrorBoundary>
  );

  return (
    <html lang="en" className="dark" data-scroll-behavior="smooth">
      <head>
        {posthogKey && (
          <Script id="posthog-header" strategy="beforeInteractive">
            {`
              !function(t,e){var o,n,p,r;e.__SV||(window.posthog&&window.posthog.__loaded)||(window.posthog=e,e._i=[],e.init=function(i,s,a){function g(t,e){var o=e.split(".");2==o.length&&(t=t[o[0]],e=o[1]),t[e]=function(){t.push([e].concat(Array.prototype.slice.call(arguments,0)))}}(p=t.createElement("script")).type="text/javascript",p.crossOrigin="anonymous",p.async=!0,p.src=s.api_host.replace(".i.posthog.com","-assets.i.posthog.com")+"/static/array.js",(r=t.getElementsByTagName("script")[0]).parentNode.insertBefore(p,r);var u=e;for(void 0!==a?u=e[a]=[]:a="posthog",u.people=u.people||[],u.toString=function(t){var e="posthog";return"posthog"!==a&&(e+="."+a),t||(e+=" (stub)"),e},u.people.toString=function(){return u.toString(1)+".people (stub)"},o="$i ji init en nn Ar tn an Yi capture calculateEventProperties dn register register_once register_for_session unregister unregister_for_session gn getFeatureFlag getFeatureFlagPayload getFeatureFlagResult isFeatureEnabled reloadFeatureFlags updateFlags updateEarlyAccessFeatureEnrollment getEarlyAccessFeatures on onFeatureFlags onSurveysLoaded onSessionId getSurveys getActiveMatchingSurveys renderSurvey displaySurvey cancelPendingSurvey canRenderSurvey canRenderSurveyAsync mn identify setPersonProperties group resetGroups setPersonPropertiesForFlags resetPersonPropertiesForFlags setGroupPropertiesForFlags reset reset setIdentity clearIdentity get_distinct_id getGroups get_session_id get_session_replay_url alias set_config startSessionRecording stopSessionRecording sessionRecordingStarted captureException addExceptionStep captureLog startExceptionAutocapture stopExceptionAutocapture loadToolbar get_property getSessionProperty fn hn createPersonProfile setInternalOrTestUser pn Ji opt_in_capturing opt_out_capturing has_opted_in_capturing has_opted_out_capturing get_explicit_consent_status is_capturing clear_opt_in_out_capturing un debug Dr vn getPageViewId captureTraceFeedback captureTraceMetric Zi".split(" "),n=0;n<o.length;n++)g(u,o[n]);e._i.push([i,s,a])},e.__SV=1)}(document,window.posthog||[]);
              posthog.init(${JSON.stringify(posthogKey)}, {
                api_host: ${JSON.stringify(posthogHost)},
                defaults: "2026-05-30",
                person_profiles: "identified_only"
              });
            `}
          </Script>
        )}
      </head>
      <body className="min-h-screen flex flex-col font-sans antialiased bg-[#020617] text-slate-200 selection:bg-indigo-500/30 selection:text-indigo-200">
        {gaId && (
          <>
            <Script
              src={`https://www.googletagmanager.com/gtag/js?id=${gaId}`}
              strategy="afterInteractive"
            />
            <Script id="google-analytics" strategy="afterInteractive">
              {`
                window.dataLayer = window.dataLayer || [];
                function gtag(){dataLayer.push(arguments);}
                gtag('js', new Date());
                gtag('config', '${gaId}', { page_path: window.location.pathname });
              `}
            </Script>
          </>
        )}
        <a
          href="#main-content"
          className="sr-only focus:not-sr-only focus:absolute focus:top-4 focus:left-4 focus:z-[100] focus:px-4 focus:py-2 focus:bg-brand-500 focus:text-white focus:rounded-lg focus:shadow-xl focus:outline-none transition-all"
        >
          Skip to main content
        </a>
        {clerkPublishableKey ? <ClerkProvider publishableKey={clerkPublishableKey}>{app}</ClerkProvider> : app}
      </body>
    </html>
  );
}
