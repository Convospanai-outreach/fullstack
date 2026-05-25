export default function SecurityPage() {
  return (
    <main className="min-h-screen bg-slate-950 px-6 py-12 text-slate-200">
      <article className="mx-auto max-w-4xl rounded-2xl border border-white/10 bg-slate-900/70 p-8 shadow-xl">
        <p className="text-sm font-semibold uppercase tracking-wide text-cyan-300">CraftMyFunnel</p>
        <h1 className="mt-3 text-4xl font-bold text-white">Security</h1>
        <p className="mt-3 text-sm text-slate-400">Last updated: May 25, 2026</p>
        <section className="mt-8 space-y-4 text-sm leading-7 text-slate-300">
          <p>CraftMyFunnel uses authentication controls, role-based and team-based access checks, encrypted secret storage where applicable, and operational safeguards to protect connected accounts and application data.</p>
          <p>Connected integrations should use least-privilege OAuth scopes. For Gmail send-only mailbox connection, the application should request only the access needed to send user-approved emails.</p>
          <p>OAuth tokens, refresh tokens, SMTP passwords, and credentials should not be exposed in frontend code, public logs, analytics tools, or support screenshots.</p>
          <p>Users should only connect Google Workspace accounts, Gmail mailboxes, domains, and sender identities they own or are authorized to use.</p>
          <p>To report a security concern, contact <a className="text-cyan-300 underline" href="mailto:support@craftmyfunnel.live">support@craftmyfunnel.live</a>.</p>
        </section>
      </article>
    </main>
  );
}
