import "./globals.css";
import { Providers } from "./providers";
import { ErrorBoundary } from "@/components/ErrorBoundary";
import { LayoutShell } from "@/components/layout/LayoutShell";
import { SupportAssistant } from "@/components/support/SupportAssistant";
import Script from "next/script";

export const metadata = {
  metadataBase: new URL(process.env["NEXTAUTH_URL"] || "http://localhost:3000"),
  title: "CraftMyFunnel — Governed Funnel Workflows for B2B Service Teams",
  description: "CraftMyFunnel helps B2B service teams manage buyer signals, approved outreach, follow-ups, and qualified meeting tracking.",
  keywords: "governed funnel workflows, qualified meetings, buyer intent, approved outreach, B2B service companies, vertical playbooks",
  icons: {
    icon: "/favicon.svg",
    apple: "/favicon.svg",
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

  return (
    <html lang="en" className="dark" data-scroll-behavior="smooth">
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
      </body>
    </html>
  );
}
