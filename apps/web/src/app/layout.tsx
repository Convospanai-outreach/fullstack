import "./globals.css";
import { Providers } from "./providers";
import { ErrorBoundary } from "@/components/ErrorBoundary";
import { LayoutShell } from "@/components/layout/LayoutShell";
import { SupportAssistant } from "@/components/support/SupportAssistant";

export const metadata = {
  title: "ConvoSpan — AI-Powered Outbound for B2B Growth Teams",
  description: "Launch personalized AI email campaigns, track buyer intent, and close more pipeline. Set up in under an hour. No credit card needed.",
  keywords: "AI outbound, B2B email campaigns, sales automation, LinkedIn outreach, lead generation, AI sales tool",
  icons: {
    icon: "/favicon.svg",
    apple: "/favicon.svg",
  },
  openGraph: {
    title: "ConvoSpan — Turn Cold Outreach into Warm Pipeline",
    description: "AI that sounds like you. Approvals built in. Replies up 3.2×. Start free.",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "ConvoSpan — AI Outbound for B2B Teams",
    description: "Launch AI email campaigns in under an hour. No credit card needed.",
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
