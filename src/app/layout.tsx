import "./globals.css";
import Header from "../components/Header";
import Footer from "../components/Footer";
import { Providers } from "./providers"; // Added provider

export const metadata = {
  title: "CovoSpan – AI Agent Army for Growth Teams",
  description: "Automate outreach, prospecting, ICP scoring, and LinkedIn workflows.",
};

import { Toaster } from "sonner"; // Add Toaster import

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="min-h-screen flex flex-col">
        <Providers>
          <Header />
          <Toaster position="top-center" richColors />
          <main className="flex-1">{children}</main>
          <Footer />
        </Providers>
      </body>
    </html>
  );
}
