import "./globals.css";
import { Providers } from "./providers";
import { ErrorBoundary } from "@/components/ErrorBoundary";
import { LayoutShell } from "@/components/layout/LayoutShell";
import { SupportAssistant } from "@/components/support/SupportAssistant";

export const metadata = {
  title: "CraftMyFunnel - AI-Managed Growth Operations Autopilot",
  description: "Turn buyer signals into qualified campaigns, approved follow-ups, landing funnels, and meeting-ready pipeline for B2B service companies.",
  keywords: "AI-managed growth operations, qualified meetings, buyer intent, managed outbound, B2B service companies, vertical playbooks",
  icons: {
    icon: "/favicon.svg",
    apple: "/favicon.svg",
  },
  openGraph: {
    title: "CraftMyFunnel - Pipeline Workflow. Prepared with AI. Governed by You.",
    description: "Buyer-signal-to-meeting workflows with managed execution and human approval controls.",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "CraftMyFunnel - Growth Autopilot for B2B Service Companies",
    description: "Launch managed growth operations from buyer signals to qualified meetings.",
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
