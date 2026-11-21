import { LawyerReview } from "../LawyerReview";
import { PRIVACY_CONTACT_EMAIL } from "@/lib/trust";

export const metadata = {
  title: "Sub-processors | CraftMyFunnel",
  description: "The third-party services that process customer data on behalf of CraftMyFunnel.",
};

// Each row is a service the code calls today (checked against apps/api and apps/web).
const rows: { name: string; purpose: string; data: string }[] = [
  { name: "Oracle Cloud", purpose: "Hosts the API and background workers", data: "All data the service processes" },
  { name: "Render", purpose: "Hosts the web application", data: "Requests and pages served to users" },
  { name: "Supabase", purpose: "Database and image storage", data: "Account, lead, campaign and message data; uploaded images" },
  { name: "Upstash", purpose: "Rate limiting and job queues (Redis)", data: "Short-lived operational data" },
  { name: "PostHog", purpose: "Product analytics", data: "Usage events" },
  { name: "Sentry", purpose: "Error monitoring", data: "Error reports, with personal data removed where possible" },
  { name: "Resend", purpose: "Sends service emails", data: "Recipient email addresses and message content" },
  { name: "OpenAI", purpose: "AI text generation and embeddings", data: "Text sent in AI requests" },
  { name: "Anthropic", purpose: "AI text generation", data: "Text sent in AI requests" },
  { name: "Google Gemini", purpose: "AI text generation and embeddings", data: "Text sent in AI requests" },
  { name: "TypeSafe", purpose: "Classifies replies and drafts", data: "Reply and draft text" },
];

export default function SubprocessorsPage() {
  return (
    <div className="min-h-screen bg-slate-950 px-6 py-12 text-slate-200">
      <article className="mx-auto max-w-4xl rounded-2xl border border-white/10 bg-slate-900/70 p-8 shadow-xl">
        <p className="text-sm font-semibold uppercase tracking-wide text-cyan-300">CraftMyFunnel</p>
        <h1 className="mt-3 text-4xl font-bold text-white">Sub-processors</h1>
        <section className="mt-8 space-y-4 text-sm leading-7 text-slate-300">
          <p>
            These services process data on CraftMyFunnel's behalf. <LawyerReview />
          </p>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="text-slate-400">
                <tr><th className="py-2 pr-4">Service</th><th className="py-2 pr-4">What it does</th><th className="py-2">Data involved</th></tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.name} className="border-t border-white/10 align-top">
                    <td className="py-2 pr-4 font-semibold text-white">{r.name}</td>
                    <td className="py-2 pr-4">{r.purpose}</td>
                    <td className="py-2">{r.data}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p>
            Services a customer connects themselves, such as their own mailbox, WhatsApp or LinkedIn account, are the customer's choice and are not listed here. <LawyerReview />
          </p>
          <p>
            Questions about this list: <a className="text-cyan-300 underline" href={`mailto:${PRIVACY_CONTACT_EMAIL}`}>{PRIVACY_CONTACT_EMAIL}</a>.
          </p>
        </section>
      </article>
    </div>
  );
}
