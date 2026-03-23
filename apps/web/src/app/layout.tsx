import "./globals.css";
import { Providers } from "./providers";
import { ErrorBoundary } from "@/components/ErrorBoundary";
import { LayoutShell } from "@/components/layout/LayoutShell";

export const metadata = {
  title: "ConvoSpan – AI Agent Army for Growth Teams",
  description: "Automate outreach, prospecting, ICP scoring, and LinkedIn workflows.",
  icons: {
    icon: "/favicon.svg",
    apple: "/favicon.svg",
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
          </Providers>
        </ErrorBoundary>
      </body>
    </html>
  );
}
