/**
 * Pure builder for a sample-funnel "tear-down" workspace. No database access: it validates a spec and
 * returns every row that would be written, so the safety rules can be unit tested.
 *
 * A tear-down is a clearly fictional workspace modelled on a prospect's niche and buyers. It never holds real
 * third-party data: lead emails must end in `.example`, no lead has consent recorded, and campaigns can only be
 * `draft` or `paused`, so nothing in it can ever be sent.
 */
import { z } from 'zod';

const STAGES = ['COLD', 'WARM', 'HOT', 'COORDINATING', 'MEETING_CONFIRMED', 'COMPLETED'] as const;
const ageDays = z.number().int().min(0).max(365);
const text = (max: number) => z.string().min(1).max(max);

export const specSchema = z.object({
  /** Lowercase letters, digits and hyphens. Becomes part of every row id. */
  slug: z.string().regex(/^[a-z0-9-]{3,40}$/),
  /** Display name of the prospect company. Appears only in the team name. */
  prospect: text(120),
  /** Credits on the new team. The Team column defaults to 100 when omitted. */
  credits: z.number().int().min(0).max(100_000).default(100),
  /** Rep's note on what the prospect sells. Documentation only: not written to the workspace. */
  offer: text(500).optional(),
  icp: z.object({ name: text(160), description: text(500), criteria: z.record(z.string(), z.unknown()) }).strict(),
  campaigns: z.array(z.object({ name: text(160), description: text(500), status: z.enum(['draft', 'paused']) }).strict()).min(1).max(5),
  leads: z.array(z.object({
    name: text(120), title: text(120), company: text(160),
    domain: z.string().regex(/^[a-z0-9-]+(\.[a-z0-9-]+)*\.example$/, 'lead domains must end in .example'),
    stage: z.enum(STAGES), value: z.number().min(0).max(10_000_000).optional(),
    /** 1-based index into `campaigns`. Defaults to the first. */
    campaign: z.number().int().min(1).max(5).optional(),
  }).strict()).min(3).max(30),
  activities: z.array(z.object({
    lead: z.number().int().min(1), channel: z.enum(['EMAIL', 'LINKEDIN', 'WHATSAPP', 'CALL']), type: text(40),
    title: text(160), notes: text(500), ageDays,
  }).strict()).max(20).default([]),
  thread: z.object({
    lead: z.number().int().min(1),
    messages: z.array(z.object({ direction: z.enum(['INBOUND', 'OUTBOUND']), sender: text(120), content: text(2000), ageDays }).strict()).min(1).max(10),
  }).strict().optional(),
  tasks: z.array(z.object({
    title: text(300), lead: z.number().int().min(1).optional(), priority: z.enum(['LOW', 'MEDIUM', 'HIGH']), dueInDays: z.number().int().min(0).max(365),
  }).strict()).max(10).default([]),
  meeting: z.object({ title: text(300), lead: z.number().int().min(1), startInDays: z.number().int().min(0).max(365), minutes: z.number().int().min(15).max(240), notes: text(500) }).strict().optional(),
  template: z.object({ name: text(160), subject: text(300), body: text(4000) }).strict().optional(),
  knowledge: z.object({ name: text(160), description: text(500), item: text(4000) }).strict().optional(),
}).strict();

export type TeardownSpec = z.input<typeof specSchema>;
type Parsed = z.output<typeof specSchema>;

export type TeardownRows = {
  teamId: string; idPrefix: string; teamName: string; credits: number;
  icp: { id: string; teamId: string; name: string; description: string; criteria: Record<string, unknown> };
  campaigns: Array<{ id: string; teamId: string; icpId: string; name: string; description: string; status: string; targetCount: number }>;
  leads: Array<{ id: string; teamId: string; campaignId: string; fullName: string; email: string; company: string; domain: string; jobTitle: string;
    location: string; status: string; source: string; tags: string[]; pipelineState: string; pipelineStateDaysAgo: number; value: number; consentObtained: false; hot: boolean }>;
  activities: Array<{ id: string; leadId: string; channel: string; type: string; title: string; notes: string; ageDays: number }>;
  messages: Array<{ id: string; leadId: string; direction: string; status: string; sender: string; content: string; ageDays: number }>;
  tasks: Array<{ id: string; teamId: string; leadId: string | null; title: string; priority: string; dueInDays: number }>;
  meetings: Array<{ id: string; teamId: string; leadId: string; title: string; startInDays: number; minutes: number; notes: string }>;
  templates: Array<{ id: string; teamId: string; name: string; subject: string; body: string }>;
  knowledgeBases: Array<{ id: string; teamId: string; name: string; description: string }>;
  knowledgeItems: Array<{ id: string; knowledgeBaseId: string; content: string }>;
};

/**
 * The only workspaces allowed to keep a fixed id outside the `teardown-` namespace. A JSON spec can never choose its
 * team id or id prefix: that is what stops `--remove` from ever reaching a real customer workspace.
 */
export const PINNED_IDENTITIES: Record<string, { teamId: string; idPrefix: string; teamName: string }> = {
  'demo-mcp': { teamId: 'demo-mcp-review-team', idPrefix: 'demo-mcp', teamName: 'CraftMyFunnel Demo' },
};

/** True only for a team this tooling is allowed to write to or delete from. */
export const isDedicatedTeam = (teamId: string) =>
  /^teardown-[a-z0-9-]{3,40}$/.test(teamId) || Object.values(PINNED_IDENTITIES).some(p => p.teamId === teamId);

export const rowId = (prefix: string, kind: string, n: number) => `${prefix}-${kind}-${String(n).padStart(2, '0')}`;

function leadRef(spec: Parsed, n: number, where: string) {
  if (n > spec.leads.length) throw new Error(`${where} refers to lead ${n} but the spec has ${spec.leads.length} leads`);
  return n;
}

export function buildTeardown(input: unknown, opts: { allowPinned?: boolean } = {}): TeardownRows {
  const parsed = specSchema.safeParse(input);
  if (!parsed.success) throw new Error(`Invalid tear-down spec: ${parsed.error.issues.map(i => `${i.path.join('.') || '(root)'}: ${i.message}`).join('; ')}`);
  const spec = parsed.data;
  const pinned = PINNED_IDENTITIES[spec.slug];
  if (pinned && !opts.allowPinned) throw new Error(`The slug "${spec.slug}" is reserved for a built-in workspace.`);
  const idPrefix = pinned ? pinned.idPrefix : `teardown-${spec.slug}`;
  const teamId = pinned ? pinned.teamId : `teardown-${spec.slug}`;
  const teamName = pinned ? pinned.teamName : `Tear-down: ${spec.prospect}`;
  const id = (kind: string, n: number) => rowId(idPrefix, kind, n);

  const leads = spec.leads.map((l, i) => {
    const campaign = l.campaign ?? 1;
    if (campaign > spec.campaigns.length) throw new Error(`lead ${i + 1} refers to campaign ${campaign} but the spec has ${spec.campaigns.length}`);
    return { id: id('lead', i + 1), teamId, campaignId: id('campaign', campaign), fullName: l.name,
      email: `${l.name.toLowerCase().replace(/[^a-z]+/g, '.').replace(/^\.|\.$/g, '')}@${l.domain}`, company: l.company, domain: l.domain, jobTitle: l.title,
      location: 'Sample City', status: 'NEW', source: 'TEARDOWN_SEED', tags: ['teardown'], pipelineState: l.stage, pipelineStateDaysAgo: Math.max(1, 12 - i),
      value: l.value ?? 0, consentObtained: false as const, hot: l.stage === 'HOT' };
  });

  const rows: TeardownRows = {
    teamId, idPrefix, teamName, credits: spec.credits,
    icp: { id: id('icp', 1), teamId, name: spec.icp.name, description: spec.icp.description, criteria: spec.icp.criteria },
    campaigns: spec.campaigns.map((c, i) => ({ id: id('campaign', i + 1), teamId, icpId: id('icp', 1), name: c.name, description: c.description, status: c.status, targetCount: 50 })),
    leads,
    activities: spec.activities.map((a, i) => ({ id: id('activity', i + 1), leadId: id('lead', leadRef(spec, a.lead, `activity ${i + 1}`)), channel: a.channel, type: a.type, title: a.title, notes: a.notes, ageDays: a.ageDays })),
    messages: spec.thread ? spec.thread.messages.map((m, i) => ({ id: id('message', i + 1), leadId: id('lead', leadRef(spec, spec.thread!.lead, 'thread')),
      direction: m.direction, status: m.direction === 'OUTBOUND' ? 'sent' : 'received', sender: m.sender, content: m.content, ageDays: m.ageDays })) : [],
    tasks: spec.tasks.map((t, i) => ({ id: id('task', i + 1), teamId, leadId: t.lead ? id('lead', leadRef(spec, t.lead, `task ${i + 1}`)) : null, title: t.title, priority: t.priority, dueInDays: t.dueInDays })),
    meetings: spec.meeting ? [{ id: id('meeting', 1), teamId, leadId: id('lead', leadRef(spec, spec.meeting.lead, 'meeting')), title: spec.meeting.title,
      startInDays: spec.meeting.startInDays, minutes: spec.meeting.minutes, notes: spec.meeting.notes }] : [],
    templates: spec.template ? [{ id: id('template', 1), teamId, ...spec.template }] : [],
    knowledgeBases: spec.knowledge ? [{ id: id('kb', 1), teamId, name: spec.knowledge.name, description: spec.knowledge.description }] : [],
    knowledgeItems: spec.knowledge ? [{ id: id('kbitem', 1), knowledgeBaseId: id('kb', 1), content: spec.knowledge.item }] : [],
  };
  assertInvariants(rows);
  return rows;
}

/** The rules that make a tear-down safe to hold in production. Throws on the first violation. */
export function assertInvariants(rows: TeardownRows): void {
  const owned = [rows.icp.id, ...rows.campaigns.map(r => r.id), ...rows.leads.map(r => r.id), ...rows.activities.map(r => r.id), ...rows.messages.map(r => r.id),
    ...rows.tasks.map(r => r.id), ...rows.meetings.map(r => r.id), ...rows.templates.map(r => r.id), ...rows.knowledgeBases.map(r => r.id), ...rows.knowledgeItems.map(r => r.id)];
  if (!isDedicatedTeam(rows.teamId)) throw new Error(`Team ${rows.teamId} is not a dedicated tear-down workspace`);
  for (const id of owned) if (!id.startsWith(`${rows.idPrefix}-`)) throw new Error(`Row id ${id} is outside the ${rows.idPrefix} namespace`);
  if (new Set(owned).size !== owned.length) throw new Error('Duplicate row ids');
  for (const l of rows.leads) {
    if (!l.email.endsWith('.example')) throw new Error(`Lead ${l.id} must use a .example address`);
    if (l.consentObtained !== false) throw new Error(`Lead ${l.id} must not have consent recorded`);
  }
  for (const c of rows.campaigns) if (c.status !== 'draft' && c.status !== 'paused') throw new Error(`Campaign ${c.id} must be draft or paused`);
  for (const r of [...rows.campaigns, ...rows.leads, ...rows.tasks, ...rows.meetings, ...rows.templates, ...rows.knowledgeBases, rows.icp]) {
    if (r.teamId !== rows.teamId) throw new Error(`Row ${r.id} belongs to a different team`);
  }
}

export const summarise = (r: TeardownRows) => `${r.campaigns.length} campaign(s), ${r.leads.length} leads, ${r.activities.length} activities, ${r.messages.length} messages, ` +
  `${r.tasks.length} tasks, ${r.meetings.length} meeting(s), ${r.templates.length} template(s), ${r.knowledgeBases.length} knowledge base(s); credits ${r.credits}`;
