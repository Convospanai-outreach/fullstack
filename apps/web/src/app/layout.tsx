import "./globals.css";
import { Providers } from "./providers";
import { ErrorBoundary } from "@/components/ErrorBoundary";
import { LayoutShell } from "@/components/layout/LayoutShell";
import { SupportAssistant } from "@/components/support/SupportAssistant";

export const metadata = {
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
};

import { Toaster } from "sonner";
import { CommandPalette } from "@/components/ui/CommandPalette";

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className="dark">
      <body className="min-h-screen flex flex-col font-sans antialiased bg-[#020617] text-slate-200 selection:bg-indigo-500/30 selection:text-indigo-200">
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
