export default function PrivacyPolicyPage() {
  return (
    <main className="min-h-screen bg-slate-950 px-6 py-12 text-slate-200">
      <article className="mx-auto max-w-4xl rounded-2xl border border-white/10 bg-slate-900/70 p-8 shadow-xl">
        <p className="text-sm font-semibold uppercase tracking-wide text-cyan-300">ConvoSpan</p>
        <h1 className="mt-3 text-4xl font-bold text-white">Privacy Policy</h1>
        <p className="mt-3 text-sm text-slate-400">Last updated: May 25, 2026</p>

        <section className="mt-8 space-y-4 text-sm leading-7 text-slate-300">
          <p>
            ConvoSpan helps teams prepare, approve, and manage outreach campaigns. This policy explains what information we collect, how we use it, and how users can request deletion of their information.
          </p>

          <h2 className="pt-4 text-2xl font-semibold text-white">Information we collect</h2>
          <p>We may collect account information such as name, email address, company or workspace name, campaign settings, lead records uploaded by users, message drafts, approval activity, and integration configuration required to provide the service.</p>

          <h2 className="pt-4 text-2xl font-semibold text-white">Google user data</h2>
          <p>
            When a user connects Google Workspace or Gmail, ConvoSpan requests only the access needed for the selected feature. For sending mail, the application should use the Gmail send permission. Google tokens are stored securely and are not sold, rented, or shared with advertisers.
          </p>
          <p>
            Google mailbox data is used only to provide requested product functionality such as connecting a sender mailbox, sending approved emails, checking mailbox status, and displaying relevant sending activity. We do not use Google user data for advertising.
          </p>

          <h2 className="pt-4 text-2xl font-semibold text-white">How we use information</h2>
          <p>We use information to provide the product, authenticate users, send approved outreach, maintain campaign records, improve reliability, prevent misuse, and support customer requests.</p>

          <h2 className="pt-4 text-2xl font-semibold text-white">Data sharing</h2>
          <p>We do not sell user data. We may share limited information with service providers that help us operate hosting, databases, authentication, email delivery, logging, security, and customer support, only as needed to provide the service.</p>

          <h2 className="pt-4 text-2xl font-semibold text-white">Data security</h2>
          <p>We use access controls, encrypted secret storage where applicable, and operational safeguards to protect user information. Users should only connect accounts they are authorized to use.</p>

          <h2 className="pt-4 text-2xl font-semibold text-white">Data retention and deletion</h2>
          <p>Users may request deletion of account, workspace, campaign, integration, or Google connection data by contacting support. When a Google mailbox is disconnected, stored OAuth tokens should be revoked or deleted from the application database.</p>

          <h2 className="pt-4 text-2xl font-semibold text-white">Contact</h2>
          <p>For privacy requests, contact: <a className="text-cyan-300 underline" href="mailto:bizcomm.soulutions@gmail.com">bizcomm.soulutions@gmail.com</a></p>
        </section>
      </article>
    </main>
  );
}
