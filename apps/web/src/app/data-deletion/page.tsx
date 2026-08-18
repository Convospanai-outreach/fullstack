export const metadata = {
  title: "Data Deletion Request | CraftMyFunnel",
  description: "How to request deletion of your data from CraftMyFunnel.",
};

export default function DataDeletionPage() {
  return (
    <div className="min-h-screen bg-slate-950 px-6 py-12 text-slate-200">
      <article className="mx-auto max-w-4xl rounded-2xl border border-white/10 bg-slate-900/70 p-8 shadow-xl">
        <p className="text-sm font-semibold uppercase tracking-wide text-cyan-300">CraftMyFunnel</p>
        <h1 className="mt-3 text-4xl font-bold text-white">Data Deletion Request</h1>
        <p className="mt-3 text-sm text-slate-400">Last updated: May 25, 2026</p>
        <section className="mt-8 space-y-4 text-sm leading-7 text-slate-300">
          <p>Users may request deletion of account data, workspace data, campaign data, uploaded lead data, connected integration data, mailbox information, and Google OAuth tokens where applicable.</p>
          <p>To request deletion, email <a className="text-cyan-300 underline" href="mailto:contact.us@craftmyfunnel.live">contact.us@craftmyfunnel.live</a> with your account email, workspace name, and deletion request.</p>
          <p>Users may also disconnect Google mailboxes from the application setup page where available.</p>
          <p>When a Google integration is disconnected or deletion is requested, Google access tokens and refresh tokens should be revoked or removed from CraftMyFunnel systems where applicable.</p>
        </section>
      </article>
    </div>
  );
}
