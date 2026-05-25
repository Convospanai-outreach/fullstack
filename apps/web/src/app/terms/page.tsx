export default function TermsPage() {
  return (
    <main className="min-h-screen bg-slate-950 px-6 py-12 text-slate-200">
      <article className="mx-auto max-w-4xl rounded-2xl border border-white/10 bg-slate-900/70 p-8 shadow-xl">
        <p className="text-sm font-semibold uppercase tracking-wide text-cyan-300">ConvoSpan</p>
        <h1 className="mt-3 text-4xl font-bold text-white">Terms of Service</h1>
        <p className="mt-3 text-sm text-slate-400">Last updated: May 25, 2026</p>

        <section className="mt-8 space-y-4 text-sm leading-7 text-slate-300">
          <p>These Terms of Service govern use of ConvoSpan, a platform for preparing, approving, and managing outreach workflows. By using ConvoSpan, you agree to these terms.</p>

          <h2 className="pt-4 text-2xl font-semibold text-white">Use of the service</h2>
          <p>You may use ConvoSpan only for lawful business purposes and only with accounts, domains, data, and integrations that you are authorized to use. You are responsible for campaign content, recipient lists, approvals, and compliance with applicable email, privacy, and anti-spam laws.</p>

          <h2 className="pt-4 text-2xl font-semibold text-white">Account and workspace responsibility</h2>
          <p>You are responsible for maintaining access control for your workspace, protecting login credentials, and ensuring that connected mailboxes and domains belong to you or your organization.</p>

          <h2 className="pt-4 text-2xl font-semibold text-white">Google Workspace and Gmail integrations</h2>
          <p>When you connect a Google Workspace or Gmail mailbox, you authorize ConvoSpan to perform the actions shown on the consent screen. ConvoSpan will use Google access only to provide the connected product features, such as sending user-approved email or checking mailbox connection status.</p>

          <h2 className="pt-4 text-2xl font-semibold text-white">Prohibited use</h2>
          <p>You must not use ConvoSpan for spam, phishing, credential harvesting, misleading identity, unauthorized scraping, malware distribution, illegal content, or campaigns that violate platform policies or applicable law.</p>

          <h2 className="pt-4 text-2xl font-semibold text-white">Service availability</h2>
          <p>We aim to keep ConvoSpan reliable, but the service may occasionally be unavailable due to maintenance, hosting, third-party services, or events outside our control.</p>

          <h2 className="pt-4 text-2xl font-semibold text-white">Limitation of liability</h2>
          <p>To the maximum extent permitted by law, ConvoSpan is provided on an as-is basis and we are not liable for indirect, incidental, special, consequential, or punitive damages arising from use of the service.</p>

          <h2 className="pt-4 text-2xl font-semibold text-white">Contact</h2>
          <p>For terms or account questions, contact: <a className="text-cyan-300 underline" href="mailto:bizcomm.soulutions@gmail.com">bizcomm.soulutions@gmail.com</a></p>
        </section>
      </article>
    </main>
  );
}
