'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';

type Consent = { client: { name: string; redirectUri: string }; scopes: string[];
  workspaces: { id: string; name: string; role: string }[] };
type Connection = { id: string; teamName: string; scopes: string[]; expiresAt: string; client: { name: string } };
const permissions: Record<string, string> = {
  'cmf:read': 'Read permitted campaigns, leads, conversations, analytics and workspace records.',
  'cmf:write': 'Create drafts, leads, templates and tasks; update lead details and recorded progress. No sending or approval decisions.',
  'cmf:generate': 'Generate message previews using your workspace’s CraftMyFunnel credits.',
};

export default function McpConnectPage() {
  const [consent, setConsent] = useState<Consent | null>(null);
  const [authorization, setAuthorization] = useState<Record<string, string> | null>(null);
  const [connections, setConnections] = useState<Connection[]>([]);
  const [serverUrl, setServerUrl] = useState('');
  const [teamId, setTeamId] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [loginUrl, setLoginUrl] = useState('/login');
  const [signedOut, setSignedOut] = useState(false);

  useEffect(() => {
    const controller = new AbortController();
    const params = new URLSearchParams(window.location.search);
    setLoginUrl(`/login?callbackUrl=${encodeURIComponent(window.location.pathname + window.location.search)}`);
    const connecting = params.has('client_id');
    if (connecting) setAuthorization(Object.fromEntries(params));
    fetch(connecting ? `/api/proxy/mcp/oauth/consent?${params}` : '/api/proxy/mcp/connections', { signal: controller.signal })
      .then(async response => {
        if (response.status === 401) { setSignedOut(true); throw new Error('Sign in to choose a workspace and review this connection.'); }
        const data = await response.json();
        if (!response.ok) throw new Error(data.error || 'Connection service is unavailable.');
        if (connecting) { setConsent(data); setTeamId(data.workspaces[0]?.id || ''); }
        else { setConnections(data.connections); setServerUrl(data.serverUrl); }
      }).catch(e => { if (e.name !== 'AbortError') setError(e.message); })
      .finally(() => setLoading(false));
    return () => controller.abort();
  }, []);

  async function connect() {
    setBusy(true); setError('');
    try {
      const response = await fetch('/api/proxy/mcp/oauth/consent', { method: 'POST',
        headers: { 'content-type': 'application/json' }, body: JSON.stringify({ authorization, teamId }) });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Could not connect.');
      // Returned only after the API validates the registered redirect URI.
      window.location.assign(data.redirectUrl);
    } catch (e) { setError(e instanceof Error ? e.message : 'Could not connect.'); setBusy(false); }
  }

  async function disconnect(id: string) {
    setBusy(true); setError('');
    try {
      const response = await fetch(`/api/proxy/mcp/connections/${encodeURIComponent(id)}`, { method: 'DELETE' });
      if (!response.ok) throw new Error('Could not disconnect. Please try again.');
      setConnections(items => items.filter(item => item.id !== id));
    } catch (e) { setError(e instanceof Error ? e.message : 'Could not disconnect.'); }
    finally { setBusy(false); }
  }

  return <main id="main-content" className="mx-auto min-h-screen max-w-3xl px-6 py-16 text-slate-100">
    <Link href="/settings" className="text-sm text-cyan-300">← Back to settings</Link>
    <h1 className="mt-6 text-3xl font-semibold">{authorization ? 'Connect your agent' : 'Agent connections'}</h1>
    <p className="mt-3 text-slate-300">Use CraftMyFunnel through an MCP-compatible agent. Every action stays within your workspace permissions.</p>
    {loading && <p role="status" className="mt-8">Loading connection details…</p>}
    {error && <p role={signedOut ? 'status' : 'alert'} className={`mt-6 rounded-lg border p-4 ${signedOut ? 'border-slate-700 text-slate-300' : 'border-red-400/40 text-red-200'}`}>{error}</p>}
    {signedOut && <Link href={loginUrl} className="mt-6 inline-block rounded-lg bg-cyan-300 px-5 py-3 font-medium text-slate-950">Sign in to CraftMyFunnel</Link>}
    {consent && <section className="mt-8 space-y-6 rounded-2xl border border-slate-700 bg-slate-900 p-6">
      <div><h2 className="text-xl font-medium">{consent.client.name} is requesting access</h2>
        <p className="mt-2 break-all text-sm text-slate-300">Registered callback: {consent.client.redirectUri}</p>
        <p className="mt-2 text-sm text-slate-400">The app name is supplied by the connecting agent. Connect only an app you recognize.</p></div>
      <label className="block">Workspace<select value={teamId} onChange={e => setTeamId(e.target.value)} className="mt-2 block w-full rounded-lg border border-slate-600 bg-slate-950 p-3">
        {consent.workspaces.map(team => <option key={team.id} value={team.id}>{team.name} ({team.role})</option>)}
      </select></label>
      {!consent.workspaces.length && <p>No active workspace is available. Complete workspace setup first.</p>}
      <ul className="list-disc space-y-3 pl-5 text-slate-300">{consent.scopes.map(scope => <li key={scope}>{permissions[scope] || scope}</li>)}</ul>
      <p className="text-sm text-slate-400">Your password is never shared. Access lasts up to 30 days; you can revoke it here at any time. Connect each workspace separately.</p>
      <div className="flex gap-4"><button type="button" disabled={busy || !teamId} onClick={connect} className="rounded-lg bg-cyan-300 px-5 py-3 font-semibold text-slate-950 disabled:opacity-50">{busy ? 'Connecting…' : 'Allow connection'}</button>
        {/* Full navigation clears the consent state preserved by client routing. */}
        <a href="/mcp/connect" className="rounded-lg border border-slate-600 px-5 py-3">Cancel</a></div>
    </section>}
    {!authorization && !loading && !signedOut && <section className="mt-8 space-y-6">
      {serverUrl && <div className="rounded-xl border border-slate-700 p-5"><h2 className="font-medium">Server URL</h2><code className="mt-2 block break-all text-cyan-200">{serverUrl}</code>
        <p className="mt-3 text-sm text-slate-300">Add this as a remote MCP server in your agent and choose OAuth sign-in. You will return here to select a workspace and review permissions.</p></div>}
      <h2 className="text-xl font-medium">Connected agents</h2>
      {!connections.length && !error && <p className="text-slate-400">No active connections. Add the server URL in ChatGPT, Claude or another MCP client to get started.</p>}
      {connections.map(item => <article key={item.id} className="rounded-xl border border-slate-700 p-5">
        <h3 className="font-medium">{item.client.name}</h3><p className="mt-1 break-all text-sm text-slate-400">Workspace: {item.teamName}</p>
        <p className="mt-2 text-sm text-slate-300">{item.scopes.map(scope => permissions[scope] || scope).join(' ')}</p>
        <p className="mt-2 text-sm text-slate-400">Expires {new Date(item.expiresAt).toLocaleDateString()}</p>
        <button type="button" disabled={busy} onClick={() => disconnect(item.id)} className="mt-4 rounded-lg border border-red-400/50 px-4 py-2 text-red-200 disabled:opacity-50">Disconnect</button>
      </article>)}
    </section>}
  </main>;
}
