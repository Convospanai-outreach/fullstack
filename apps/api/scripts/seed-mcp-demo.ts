/**
 * Seeds one clearly fictional "CraftMyFunnel Demo" workspace for MCP directory review.
 *
 *   DEMO_OWNER_EMAIL=you@example.com tsx scripts/seed-mcp-demo.ts            # dry run, writes nothing
 *   DEMO_OWNER_EMAIL=you@example.com tsx scripts/seed-mcp-demo.ts --apply    # writes
 *   tsx scripts/seed-mcp-demo.ts --remove --apply                            # deletes only the demo team's rows
 *
 * Safety: every row is scoped to the fixed demo team id; nothing outside it is read or changed.
 * Campaigns are only ever 'draft' or 'paused' and leads use reserved .example addresses with no
 * consent, so no worker can send to them. Idempotent: re-running updates rows in place.
 */
import { prisma } from '../src/lib/db';

const TEAM_ID = 'demo-mcp-review-team';
const id = (kind: string, n: number) => `demo-mcp-${kind}-${String(n).padStart(2, '0')}`;
const apply = process.argv.includes('--apply');
const remove = process.argv.includes('--remove');
const daysAgo = (n: number) => new Date(Date.now() - n * 86_400_000);
const daysAhead = (n: number) => new Date(Date.now() + n * 86_400_000);

const LEADS: Array<{ name: string; title: string; company: string; domain: string; stage: string; value?: number }> = [
  { name: 'Asha Verma', title: 'VP Sales', company: 'Northwind Logistics (demo)', domain: 'northwind-demo.example', stage: 'COLD' },
  { name: 'Ben Carter', title: 'Head of Growth', company: 'Brightpath Software (demo)', domain: 'brightpath-demo.example', stage: 'COLD' },
  { name: 'Chen Li', title: 'Sales Director', company: 'Harbor Freight Tech (demo)', domain: 'harbor-demo.example', stage: 'COLD' },
  { name: 'Dana Ortiz', title: 'CRO', company: 'Lumen Analytics (demo)', domain: 'lumen-demo.example', stage: 'WARM' },
  { name: 'Elif Demir', title: 'VP Revenue', company: 'Cedar Ops (demo)', domain: 'cedar-demo.example', stage: 'WARM' },
  { name: 'Femi Adeyemi', title: 'Founder', company: 'Orbit Payments (demo)', domain: 'orbit-demo.example', stage: 'WARM' },
  { name: 'Grace Kim', title: 'Head of Sales', company: 'Pinecrest Health IT (demo)', domain: 'pinecrest-demo.example', stage: 'HOT', value: 12000 },
  { name: 'Hugo Martin', title: 'COO', company: 'Delta Fleet (demo)', domain: 'deltafleet-demo.example', stage: 'HOT', value: 8000 },
  { name: 'Isha Rao', title: 'Sales Ops Lead', company: 'Quanta Retail (demo)', domain: 'quanta-demo.example', stage: 'COORDINATING', value: 15000 },
  { name: 'Jonas Weber', title: 'VP Sales', company: 'Alpine Industrial (demo)', domain: 'alpine-demo.example', stage: 'MEETING_CONFIRMED', value: 20000 },
  { name: 'Kara Singh', title: 'Director of Partnerships', company: 'Vertex Cloud (demo)', domain: 'vertex-demo.example', stage: 'MEETING_CONFIRMED', value: 18000 },
  { name: 'Leo Novak', title: 'Head of Revenue', company: 'Maple Ledger (demo)', domain: 'mapleledger-demo.example', stage: 'COMPLETED', value: 9000 },
];

async function removeDemo() {
  const leadIds = (await prisma.lead.findMany({ where: { teamId: TEAM_ID }, select: { id: true } })).map(l => l.id);
  const kbIds = (await prisma.knowledgeBase.findMany({ where: { teamId: TEAM_ID }, select: { id: true } })).map(k => k.id);
  await prisma.$transaction([
    prisma.message.deleteMany({ where: { leadId: { in: leadIds } } }),
    prisma.leadActivity.deleteMany({ where: { leadId: { in: leadIds } } }),
    prisma.task.deleteMany({ where: { teamId: TEAM_ID } }),
    prisma.meeting.deleteMany({ where: { teamId: TEAM_ID } }),
    prisma.lead.deleteMany({ where: { teamId: TEAM_ID } }),
    prisma.campaign.deleteMany({ where: { teamId: TEAM_ID } }),
    prisma.iCP.deleteMany({ where: { teamId: TEAM_ID } }),
    prisma.emailTemplate.deleteMany({ where: { teamId: TEAM_ID } }),
    prisma.knowledgeItem.deleteMany({ where: { knowledgeBaseId: { in: kbIds } } }),
    prisma.knowledgeBase.deleteMany({ where: { teamId: TEAM_ID } }),
  ]);
  console.log('Removed demo rows. The team and its membership were left in place.');
}

async function seed(ownerId: string, ownerEmail: string) {
  await prisma.team.upsert({ where: { id: TEAM_ID }, update: { name: 'CraftMyFunnel Demo' },
    create: { id: TEAM_ID, name: 'CraftMyFunnel Demo', credits: 100 } });
  const member = await prisma.teamMember.findFirst({ where: { teamId: TEAM_ID, userId: ownerId } });
  if (!member) await prisma.teamMember.create({ data: { teamId: TEAM_ID, userId: ownerId, email: ownerEmail, role: 'owner', status: 'active' } });

  await prisma.iCP.upsert({ where: { id: id('icp', 1) }, update: {}, create: {
    id: id('icp', 1), teamId: TEAM_ID, name: 'Demo: B2B SaaS sales leaders',
    description: 'Fictional example profile for directory review.',
    criteria: { titles: ['VP Sales', 'Head of Growth', 'CRO'], industries: ['B2B SaaS', 'Logistics'], companySize: '50-500', regions: ['US', 'UK'] } } });

  const campaigns = [
    { n: 1, name: 'Demo: Q4 SaaS pipeline push', status: 'draft', description: 'Draft campaign created from the demo ICP. Nothing is sent.' },
    { n: 2, name: 'Demo: Logistics outreach (paused)', status: 'paused', description: 'Paused example campaign with a few attached leads.' },
  ];
  for (const c of campaigns) await prisma.campaign.upsert({ where: { id: id('campaign', c.n) }, update: { name: c.name, status: c.status },
    create: { id: id('campaign', c.n), teamId: TEAM_ID, ownerId, icpId: id('icp', 1), name: c.name, description: c.description, status: c.status, targetCount: 50 } });

  for (const [i, l] of LEADS.entries()) {
    const slug = l.name.toLowerCase().replace(/[^a-z]+/g, '.');
    const data = { fullName: l.name, email: `${slug}@${l.domain}`, company: l.company, domain: l.domain, jobTitle: l.title, location: 'Demo City',
      teamId: TEAM_ID, campaignId: id('campaign', i % 3 === 0 ? 2 : 1), status: 'NEW', source: 'DEMO_SEED', tags: ['demo'],
      pipelineState: l.stage, pipelineStateChangedAt: daysAgo(12 - i), value: l.value ?? 0, consentObtained: false,
      ...(l.stage === 'HOT' ? { hotAt: daysAgo(3) } : {}) };
    await prisma.lead.upsert({ where: { id: id('lead', i + 1) }, update: data, create: { id: id('lead', i + 1), ...data } });
  }

  const activities = [
    { lead: 7, channel: 'EMAIL', type: 'CONTACTED', title: 'Intro email (demo)', notes: 'Fictional example activity.', age: 6 },
    { lead: 7, channel: 'EMAIL', type: 'REPLIED', title: 'Replied (demo)', notes: 'Asked about pricing.', age: 4 },
    { lead: 9, channel: 'LINKEDIN', type: 'CONTACTED', title: 'Connection note (demo)', notes: 'Fictional example activity.', age: 5 },
    { lead: 10, channel: 'CALL', type: 'CONTACTED', title: 'Discovery call booked (demo)', notes: 'Fictional example activity.', age: 2 },
  ];
  for (const [i, a] of activities.entries()) await prisma.leadActivity.upsert({ where: { id: id('activity', i + 1) }, update: {},
    create: { id: id('activity', i + 1), leadId: id('lead', a.lead), channel: a.channel, type: a.type, title: a.title, notes: a.notes, createdBy: ownerId, createdAt: daysAgo(a.age) } });

  // One conversation thread on a HOT lead so get_lead_thread has something to show.
  const thread = [
    { n: 1, direction: 'OUTBOUND', status: 'sent', sender: 'Demo Rep', content: 'Hi Grace, I noticed Pinecrest is hiring SDRs. We help sales teams review every outreach draft before it goes out. Open to a short chat? (Demo message)', age: 6 },
    { n: 2, direction: 'INBOUND', status: 'received', sender: 'Grace Kim', content: 'Sounds relevant. What does pricing look like for a team of 8? (Demo message)', age: 4 },
  ];
  for (const m of thread) await prisma.message.upsert({ where: { id: id('message', m.n) }, update: {},
    create: { id: id('message', m.n), leadId: id('lead', 7), platform: 'EMAIL', direction: m.direction, status: m.status, sender: m.sender, content: m.content, isRead: m.direction === 'OUTBOUND', createdAt: daysAgo(m.age) } });

  const tasks = [
    { n: 1, title: 'Demo: send pricing to Grace Kim', lead: 7, priority: 'HIGH', due: daysAhead(1) },
    { n: 2, title: 'Demo: follow up with Isha Rao', lead: 9, priority: 'MEDIUM', due: daysAhead(3) },
    { n: 3, title: 'Demo: review draft campaign copy', lead: null, priority: 'LOW', due: daysAhead(5) },
  ];
  for (const t of tasks) await prisma.task.upsert({ where: { id: id('task', t.n) }, update: {},
    create: { id: id('task', t.n), teamId: TEAM_ID, userId: ownerId, title: t.title, leadId: t.lead ? id('lead', t.lead) : null, priority: t.priority, dueDate: t.due } });

  await prisma.meeting.upsert({ where: { id: id('meeting', 1) }, update: {}, create: { id: id('meeting', 1), teamId: TEAM_ID, leadId: id('lead', 10),
    title: 'Demo: discovery call with Alpine Industrial', startTime: daysAhead(2), endTime: new Date(daysAhead(2).getTime() + 30 * 60_000), notes: 'Fictional example meeting record.' } });

  await prisma.emailTemplate.upsert({ where: { id: id('template', 1) }, update: {}, create: { id: id('template', 1), teamId: TEAM_ID,
    name: 'Demo: short intro', subject: 'Quick idea for {{company}}', body: 'Hi {{firstName}},\n\nExample template for directory review.\n\nBest,\nDemo Rep' } });

  await prisma.knowledgeBase.upsert({ where: { id: id('kb', 1) }, update: {}, create: { id: id('kb', 1), teamId: TEAM_ID,
    name: 'Demo: product FAQ', description: 'Fictional example knowledge base.' } });
  await prisma.knowledgeItem.upsert({ where: { id: id('kbitem', 1) }, update: {}, create: { id: id('kbitem', 1), knowledgeBaseId: id('kb', 1),
    content: 'Demo FAQ: CraftMyFunnel drafts outreach and holds every message for human review before it is sent.', metadata: { source: 'demo' } } });

  console.log(`Seeded demo workspace ${TEAM_ID}: 1 ICP, 2 campaigns, ${LEADS.length} leads, 4 activities, 2 messages, 3 tasks, 1 meeting, 1 template, 1 knowledge base.`);
}

async function main() {
  const host = new URL(process.env.DATABASE_URL || 'postgres://unset').hostname;
  console.log(`Target database host: ${host}  mode: ${apply ? 'APPLY' : 'DRY RUN (add --apply to write)'}${remove ? ' (remove)' : ''}`);
  if (remove) { if (apply) await removeDemo(); return; }
  const email = process.env.DEMO_OWNER_EMAIL;
  if (!email) throw new Error('Set DEMO_OWNER_EMAIL to an existing account that should own the demo team.');
  const owner = await prisma.user.findUnique({ where: { email }, select: { id: true, email: true } });
  if (!owner) throw new Error('No user with that DEMO_OWNER_EMAIL exists.');
  console.log(`Owner account found. Would seed team "${TEAM_ID}" with ${LEADS.length} leads and supporting records.`);
  if (apply) await seed(owner.id, owner.email || email);
}

main().catch(e => { console.error(e instanceof Error ? e.message : e); process.exitCode = 1; }).finally(() => prisma.$disconnect());
