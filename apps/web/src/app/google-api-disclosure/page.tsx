export default function GoogleApiDisclosurePage() {
  return (
    <main className="min-h-screen bg-slate-950 px-6 py-12 text-slate-200">
      <article className="mx-auto max-w-4xl rounded-2xl border border-white/10 bg-slate-900/70 p-8 shadow-xl">
        <p className="text-sm font-semibold uppercase tracking-wide text-cyan-300">CraftMyFunnel</p>
        <h1 className="mt-3 text-4xl font-bold text-white">Google API Disclosure</h1>
        <p className="mt-3 text-sm text-slate-400">Last updated: May 25, 2026</p>

        <section className="mt-8 space-y-4 text-sm leading-7 text-slate-300">
          <p>CraftMyFunnel uses Google APIs only to provide user-requested product functionality.</p>
          <p>If Gmail send-only access is enabled, CraftMyFunnel uses Gmail API access to send user-approved outreach emails from the connected mailbox.</p>
          <p>If reply or bounce sync is enabled in the future, additional mailbox permissions may be requested and will be shown on the Google consent screen before use.</p>
          <p>CraftMyFunnel does not sell Google user data, does not use Google user data for advertising, and does not transfer Google user data to third parties except as necessary to provide or improve user-facing features, comply with law, or protect the service.</p>
          <p>CraftMyFunnel’s use and transfer of information received from Google APIs will adhere to the Google API Services User Data Policy, including the Limited Use requirements.</p>
          <p>Users may disconnect Google integrations from the application setup page where available or contact <a className="text-cyan-300 underline" href="mailto:support@craftmyfunnel.live">support@craftmyfunnel.live</a> for assistance.</p>
        </section>
      </article>
    </main>
  );
}
