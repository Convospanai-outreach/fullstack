import "./globals.css";
import { Providers } from "./providers";
import { ErrorBoundary } from "@/components/ErrorBoundary";
import { LayoutShell } from "@/components/layout/LayoutShell";
import { SupportAssistant } from "@/components/support/SupportAssistant";
import { StrictQualityBoundary } from "@/components/StrictQualityBoundary";
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
import { GoogleAnalytics } from "@/components/analytics/GoogleAnalytics";

export default function RootLayout({ children }: { children: React.ReactNode }) {
  const posthogKey = process.env["NEXT_PUBLIC_POSTHOG_KEY"];
  const posthogHost = process.env["NEXT_PUBLIC_POSTHOG_HOST"] || "https://us.i.posthog.com";
  const app = (
    <ErrorBoundary>
      <Providers>
        <CommandPalette />
        <Toaster position="top-center" richColors />
        <LayoutShell>
          <StrictQualityBoundary moduleName="RootApplicationShell" strictMode>
            {children}
          </StrictQualityBoundary>
        </LayoutShell>
        <SupportAssistant />
      </Providers>
    </ErrorBoundary>
  );

  return (
    <ClerkProvider>
      <html lang="en" className="dark" data-scroll-behavior="smooth">
        <head>
          <link rel="alternate" type="text/markdown" href="/llms.txt" title="LLM Summary" />
          <link rel="alternate" type="text/markdown" href="/llms-full.txt" title="LLM Full Architecture Specification" />
          <script
            type="application/ld+json"
            dangerouslySetInnerHTML={{
              __html: JSON.stringify({
                "@context": "https://schema.org",
                "@graph": [
                  {
                    "@type": "Organization",
                    "@id": "https://craftmyfunnel.live/#organization",
                    "name": "CraftMyFunnel",
                    "url": "https://craftmyfunnel.live",
                    "logo": "https://craftmyfunnel.live/craftmyfunnel-logo.png",
                    "description": "Governed AI outreach and qualified meeting workflow platform for B2B service teams and revenue operations.",
                    "sameAs": [
                      "https://github.com/Convospanai-outreach/fullstack",
                      "https://twitter.com/craftmyfunnel"
                    ],
                    "contactPoint": {
                      "@type": "ContactPoint",
                      "email": "contact.us@craftmyfunnel.live",
                      "contactType": "customer support",
                      "availableLanguage": ["English"]
                    },
                    "knowsAbout": [
                      "B2B Outreach Automation",
                      "Human-in-the-Loop AI Review",
                      "Email Deliverability & RFC 5322 Message-ID",
                      "RFC 8058 One-Click Unsubscribe",
                      "Multi-Tenant Isolation & HMAC-SHA256 Blind Indexing",
                      "Transactional Outbox Pattern"
                    ]
                  },
                  {
                    "@type": "WebSite",
                    "@id": "https://craftmyfunnel.live/#website",
                    "url": "https://craftmyfunnel.live",
                    "name": "CraftMyFunnel",
                    "publisher": {
                      "@id": "https://craftmyfunnel.live/#organization"
                    }
                  },
                  {
                    "@type": "SoftwareApplication",
                    "@id": "https://craftmyfunnel.live/#software",
                    "name": "CraftMyFunnel",
                    "applicationCategory": "BusinessApplication",
                    "operatingSystem": "Web Browser, Cloud",
                    "offers": {
                      "@type": "AggregateOffer",
                      "priceCurrency": "USD",
                      "lowPrice": "49",
                      "highPrice": "499",
                      "offerCount": "3",
                      "offers": [
                        {
                          "@type": "Offer",
                          "name": "Pilot",
                          "price": "49",
                          "priceCurrency": "USD",
                          "description": "30-day growth pilot package for one ICP, one geography, and one offer"
                        },
                        {
                          "@type": "Offer",
                          "name": "Growth Autopilot",
                          "price": "99",
                          "priceCurrency": "USD",
                          "description": "Monthly managed campaign operations for repeatable pipeline tracking"
                        },
                        {
                          "@type": "Offer",
                          "name": "Enterprise",
                          "price": "499",
                          "priceCurrency": "USD",
                          "description": "Custom vertical playbooks, governance, and private-data execution options"
                        }
                      ]
                    },
                    "description": "Governed B2B outreach platform combining intent signal ingestion, AI draft generation with human review, deliverability guardrails, and meeting tracking.",
                    "featureList": [
                      "Human-in-the-loop email draft approval queue",
                      "Google Workspace & Gmail deliverability guardrails",
                      "Deterministic blind indexing and transactional outbox",
                      "RFC 5322 Message-ID threading & RFC 8058 unsubscribe support",
                      "Multi-tenant workspace isolation and role-based access control",
                      "Vertical outbound playbooks and AI personalization"
                    ]
                  }
                ]
              })
            }}
          />
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
          <GoogleAnalytics />
          <a
            href="#main-content"
            className="sr-only focus:not-sr-only focus:absolute focus:top-4 focus:left-4 focus:z-[100] focus:px-4 focus:py-2 focus:bg-brand-500 focus:text-white focus:rounded-lg focus:shadow-xl focus:outline-none transition-all"
          >
            Skip to main content
          </a>
          {app}
        </body>
      </html>
    </ClerkProvider>
  );
}
