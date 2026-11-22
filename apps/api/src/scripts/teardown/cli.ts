import { readFileSync } from 'node:fs';
import { prisma } from '../../lib/db';
import { buildTeardown, summarise, type TeardownRows } from './build';
import { applyTeardown, removeTeardown } from './write';

/** Shared CLI body for the tear-down and demo-seed entry points. Dry run unless --apply is passed. */
export async function runTeardownCli(input: unknown, argv: string[], env: NodeJS.ProcessEnv, opts: { allowPinned?: boolean } = {}): Promise<void> {
  const apply = argv.includes('--apply');
  const remove = argv.includes('--remove');
  const rows: TeardownRows = buildTeardown(input, opts);
  const url = new URL(env['DATABASE_URL'] || 'postgres://unset');
  const host = `${url.hostname}:${url.port || 'default'}${url.pathname}`;
  console.log(`Target database: ${host}  mode: ${apply ? 'APPLY' : 'DRY RUN (add --apply to write)'}${remove ? ' (remove)' : ''}`);
  console.log(`Workspace: ${rows.teamName} (${rows.teamId})`);
  console.log(`Rows: ${summarise(rows)}`);
  console.log('Safety checks passed: ids namespaced, .example leads, no consent, campaigns draft/paused only.');

  const email = env['OWNER_EMAIL'] || env['DEMO_OWNER_EMAIL'];
  if (!email) throw new Error('Set OWNER_EMAIL to an existing account that should own this workspace.');
  const owner = await prisma.user.findUnique({ where: { email }, select: { id: true, email: true } });
  if (!owner) throw new Error('No user with that OWNER_EMAIL exists.');
  console.log('Owner account found.');
  if (!apply) return;
  const who = { id: owner.id, email: owner.email || email };
  if (remove) { await removeTeardown(prisma, rows); console.log('Removed the workspace rows. The team row stays; every membership on it is now inactive.'); }
  else { await applyTeardown(prisma, rows, who); console.log('Applied.'); }
}

export const readSpec = (path: string): unknown => JSON.parse(readFileSync(path, 'utf8'));

export async function main(load: () => unknown, opts: { allowPinned?: boolean } = {}): Promise<void> {
  try { await runTeardownCli(load(), process.argv.slice(2), process.env, opts); }
  catch (e) { console.error(e instanceof Error ? e.message : e); process.exitCode = 1; }
  finally { await prisma.$disconnect(); }
}
