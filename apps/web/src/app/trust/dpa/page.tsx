import { LawyerReview } from "../LawyerReview";
import { PRIVACY_CONTACT_EMAIL } from "@/lib/trust";

export const metadata = {
  title: "Data Processing Agreement (template) | CraftMyFunnel",
  description: "Template data processing agreement for customers who use CraftMyFunnel to process personal data.",
};

const clauses: { heading: string; text: string }[] = [
  { heading: "Parties and roles", text: "The customer decides why and how the personal data of its leads and contacts is processed. CraftMyFunnel processes that data on the customer's behalf, to provide the service." },
  { heading: "Instructions", text: "CraftMyFunnel processes personal data only on the customer's documented instructions, which are the customer's use of the service and its settings." },
  { heading: "Confidentiality", text: "People at CraftMyFunnel who can access customer personal data are bound to keep it confidential." },
  { heading: "Security", text: "CraftMyFunnel applies technical and organisational measures to protect customer personal data. The measures are described on the Security page." },
  { heading: "Sub-processors", text: "CraftMyFunnel uses the sub-processors listed on the sub-processors page, and will update that list when it changes." },
  { heading: "Helping with requests", text: "CraftMyFunnel helps the customer respond to requests from the people the data is about, such as access, correction and erasure." },
  { heading: "Personal data breach", text: "CraftMyFunnel tells the customer without undue delay after it becomes aware of a personal data breach affecting the customer's data." },
  { heading: "Return and deletion", text: "When the agreement ends, CraftMyFunnel deletes or returns the customer's personal data on request, unless the law requires it to be kept." },
  { heading: "Records and audits", text: "CraftMyFunnel provides the information needed to show it follows this agreement and allows reasonable audits by the customer." },
];

export default function DpaPage() {
  return (
    <div className="min-h-screen bg-slate-950 px-6 py-12 text-slate-200">
      <article className="mx-auto max-w-4xl rounded-2xl border border-white/10 bg-slate-900/70 p-8 shadow-xl">
        <p className="text-sm font-semibold uppercase tracking-wide text-cyan-300">CraftMyFunnel</p>
        <h1 className="mt-3 text-4xl font-bold text-white">Data Processing Agreement (template)</h1>
        <p className="mt-3 text-sm text-slate-400">
          This is a template, not a signed agreement. <LawyerReview />
        </p>
        <section className="mt-8 space-y-6 text-sm leading-7 text-slate-300">
          {clauses.map((c) => (
            <div key={c.heading}>
              <h2 className="text-lg font-semibold text-white">{c.heading}</h2>
              <p>{c.text} <LawyerReview /></p>
            </div>
          ))}
          <p>
            To ask for a signed copy or to raise a privacy question, contact{" "}
            <a className="text-cyan-300 underline" href={`mailto:${PRIVACY_CONTACT_EMAIL}`}>{PRIVACY_CONTACT_EMAIL}</a>.
          </p>
        </section>
      </article>
    </div>
  );
}
