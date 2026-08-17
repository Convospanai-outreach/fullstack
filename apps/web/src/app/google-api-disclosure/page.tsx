export default function GoogleApiDisclosurePage() {
  return (
    <div className="min-h-screen bg-slate-950 px-6 py-12 text-slate-200">
      <article className="mx-auto max-w-4xl rounded-2xl border border-white/10 bg-slate-900/70 p-8 shadow-xl">
        <p className="text-sm font-semibold uppercase tracking-wide text-cyan-300">CraftMyFunnel</p>
        <h1 className="mt-3 text-4xl font-bold text-white">Google API Disclosure</h1>
        <p className="mt-3 text-sm text-slate-400">Last updated: August 11, 2026</p>

        <section className="mt-8 space-y-4 text-sm leading-7 text-slate-300">
          <p>CraftMyFunnel uses Google APIs only to provide user-requested product functionality.</p>
          <p>CraftMyFunnel uses Gmail API access to (1) send user-approved outreach emails from the connected mailbox, and (2) read limited mailbox data — message headers such as thread ID, In-Reply-To, and References — solely to detect replies to sent campaign emails, so reply status can be shown in the product. Gmail message content outside of this reply-matching purpose is not read, stored, or processed.</p>
          <p>CraftMyFunnel does not sell Google user data, does not use Google user data for advertising, and does not transfer Google user data to third parties except as necessary to provide or improve user-facing features, comply with law, or protect the service.</p>
          <p>CraftMyFunnel’s use and transfer of information received from Google APIs will adhere to the Google API Services User Data Policy, including the Limited Use requirements.</p>
          <p>Users may disconnect Google integrations from the application setup page where available or contact <a className="text-cyan-300 underline" href="mailto:contact.us@craftmyfunnel.live">contact.us@craftmyfunnel.live</a> for assistance.</p>
        </section>
      </article>
    </div>
  );
}
