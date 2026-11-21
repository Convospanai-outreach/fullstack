import { describe, it, expect, vi } from 'vitest';
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { buildTeardown, assertInvariants } from './build';
import { DEMO_SPEC } from './demoSpec';
import { removeTeardown } from './write';

const base = () => ({
  slug: 'acme-sec', prospect: 'Acme Security', offer: 'Managed detection for mid-market firms',
  icp: { name: 'Mid-market CISOs', description: 'Fictional buyer profile', criteria: { titles: ['CISO'] } },
  campaigns: [{ name: 'Sample campaign', description: 'Draft only', status: 'draft' as const }],
  leads: [
    { name: 'Ana Reyes', title: 'CISO', company: 'Sample One', domain: 'sample-one.example', stage: 'COLD' as const },
    { name: 'Bo Chan', title: 'IT Director', company: 'Sample Two', domain: 'sample-two.example', stage: 'WARM' as const },
    { name: 'Cy Ford', title: 'VP IT', company: 'Sample Three', domain: 'sample-three.example', stage: 'HOT' as const },
  ],
});

describe('buildTeardown', () => {
  it('namespaces every id and the team by slug', () => {
    const rows = buildTeardown(base());
    expect(rows.teamId).toBe('teardown-acme-sec');
    expect(rows.teamName).toBe('Tear-down: Acme Security');
    for (const l of rows.leads) expect(l.id.startsWith('teardown-acme-sec-')).toBe(true);
  });

  it('uses .example emails, records no consent, and defaults credits to 100', () => {
    const rows = buildTeardown(base());
    expect(rows.credits).toBe(100);
    for (const l of rows.leads) { expect(l.email.endsWith('.example')).toBe(true); expect(l.consentObtained).toBe(false); }
  });

  it('honours an explicit credit count, including 0', () => {
    expect(buildTeardown({ ...base(), credits: 0 }).credits).toBe(0);
  });

  it('rejects real-looking domains, active campaigns and bad slugs', () => {
    const b = base();
    expect(() => buildTeardown({ ...b, leads: [{ ...b.leads[0]!, domain: 'gmail.com' }, b.leads[1], b.leads[2]] })).toThrow(/\.example/);
    expect(() => buildTeardown({ ...b, campaigns: [{ ...b.campaigns[0]!, status: 'active' }] })).toThrow();
    expect(() => buildTeardown({ ...b, slug: 'Bad Slug!' })).toThrow();
  });

  it('rejects references to leads or campaigns that do not exist', () => {
    const b = base();
    expect(() => buildTeardown({ ...b, tasks: [{ title: 't', lead: 9, priority: 'LOW', dueInDays: 1 }] })).toThrow(/lead 9/);
    expect(() => buildTeardown({ ...b, leads: [{ ...b.leads[0]!, campaign: 3 }, b.leads[1], b.leads[2]] })).toThrow(/campaign 3/);
  });

  it('assertInvariants catches a row outside the namespace and a sendable campaign', () => {
    const rows = buildTeardown(base());
    expect(() => assertInvariants({ ...rows, leads: [{ ...rows.leads[0]!, id: 'other-lead-01' }] })).toThrow(/namespace/);
    expect(() => assertInvariants({ ...rows, campaigns: [{ ...rows.campaigns[0]!, status: 'active' }] })).toThrow(/draft or paused/);
  });

  it('keeps the demo workspace ids stable so a re-run updates production rows in place', () => {
    const rows = buildTeardown(DEMO_SPEC);
    expect(rows.teamId).toBe('demo-mcp-review-team');
    expect(rows.icp.id).toBe('demo-mcp-icp-01');
    expect(rows.leads[0]!.id).toBe('demo-mcp-lead-01');
    expect(rows.leads).toHaveLength(12);
    expect(rows.campaigns.map(c => c.status)).toEqual(['draft', 'paused']);
  });
});

describe('removeTeardown', () => {
  it('only deletes within the tear-down team and deactivates that membership', async () => {
    const rows = buildTeardown(base());
    const calls: Array<[string, unknown]> = [];
    const op = (name: string) => vi.fn((args: unknown) => { calls.push([name, args]); return Promise.resolve({ count: 0 }); });
    const prisma = {
      lead: { findMany: vi.fn().mockResolvedValue([{ id: 'teardown-acme-sec-lead-01' }]), deleteMany: op('lead') },
      knowledgeBase: { findMany: vi.fn().mockResolvedValue([]), deleteMany: op('knowledgeBase') },
      message: { deleteMany: op('message') }, leadActivity: { deleteMany: op('leadActivity') }, task: { deleteMany: op('task') },
      meeting: { deleteMany: op('meeting') }, campaign: { deleteMany: op('campaign') }, iCP: { deleteMany: op('icp') },
      emailTemplate: { deleteMany: op('template') }, knowledgeItem: { deleteMany: op('knowledgeItem') },
      teamMember: { updateMany: op('teamMember') }, team: { delete: vi.fn() },
      $transaction: vi.fn((ops: Promise<unknown>[]) => Promise.all(ops)),
    };
    await removeTeardown(prisma as never, rows, { id: 'user-1', email: 'rep@example.com' });

    expect(prisma.team.delete).not.toHaveBeenCalled();
    const json = JSON.stringify(calls);
    expect(json).not.toContain('"where":{}');
    for (const [name, args] of calls) {
      const where = JSON.stringify((args as { where: unknown }).where);
      const scoped = where.includes('teardown-acme-sec') || where.includes('"in"');
      expect(scoped, `${name} delete must be scoped, got ${where}`).toBe(true);
    }
    expect(calls.find(([n]) => n === 'teamMember')![1]).toEqual({ where: { teamId: 'teardown-acme-sec', userId: 'user-1' }, data: { status: 'inactive' } });
  });
});

describe('committed example specs', () => {
  const dir = join(__dirname, 'specs');
  for (const f of readdirSync(dir).filter(n => n.endsWith('.json'))) {
    it(`${f} builds and passes the safety invariants`, () => {
      const rows = buildTeardown(JSON.parse(readFileSync(join(dir, f), 'utf8')));
      expect(rows.credits).toBe(0);
      expect(rows.leads.length).toBeGreaterThanOrEqual(3);
    });
  }
});
