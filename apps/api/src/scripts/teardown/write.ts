import type { PrismaClient } from '@prisma/client';
import type { TeardownRows } from './build';

const daysAgo = (n: number) => new Date(Date.now() - n * 86_400_000);
const daysAhead = (n: number) => new Date(Date.now() + n * 86_400_000);

export type Owner = { id: string; email: string };

/** Upserts every row by its fixed id, so re-running updates in place. Never touches rows outside the tear-down team. */
export async function applyTeardown(prisma: PrismaClient, rows: TeardownRows, owner: Owner): Promise<void> {
  const { teamId } = rows;
  await prisma.team.upsert({ where: { id: teamId }, update: { name: rows.teamName },
    create: { id: teamId, name: rows.teamName, credits: rows.credits } });
  const member = await prisma.teamMember.findFirst({ where: { teamId, userId: owner.id } });
  if (member) await prisma.teamMember.update({ where: { id: member.id }, data: { role: 'owner', status: 'active' } });
  else await prisma.teamMember.create({ data: { teamId, userId: owner.id, email: owner.email, role: 'owner', status: 'active' } });

  const { icp } = rows;
  await prisma.iCP.upsert({ where: { id: icp.id }, update: { name: icp.name, description: icp.description, criteria: icp.criteria as object },
    create: { id: icp.id, teamId, name: icp.name, description: icp.description, criteria: icp.criteria as object } });

  for (const c of rows.campaigns) {
    await prisma.campaign.upsert({ where: { id: c.id }, update: { name: c.name, description: c.description, status: c.status },
      create: { id: c.id, teamId, ownerId: owner.id, icpId: c.icpId, name: c.name, description: c.description, status: c.status, targetCount: c.targetCount } });
  }
  for (const l of rows.leads) {
    const data = { fullName: l.fullName, email: l.email, company: l.company, domain: l.domain, jobTitle: l.jobTitle, location: l.location, teamId, campaignId: l.campaignId,
      status: l.status, source: l.source, tags: l.tags, pipelineState: l.pipelineState, pipelineStateChangedAt: daysAgo(l.pipelineStateDaysAgo), value: l.value,
      consentObtained: l.consentObtained, ...(l.hot ? { hotAt: daysAgo(3) } : {}) };
    await prisma.lead.upsert({ where: { id: l.id }, update: data, create: { id: l.id, ...data } });
  }
  for (const a of rows.activities) {
    await prisma.leadActivity.upsert({ where: { id: a.id }, update: { title: a.title, notes: a.notes },
      create: { id: a.id, leadId: a.leadId, channel: a.channel, type: a.type, title: a.title, notes: a.notes, createdBy: owner.id, createdAt: daysAgo(a.ageDays) } });
  }
  for (const m of rows.messages) {
    await prisma.message.upsert({ where: { id: m.id }, update: { content: m.content },
      create: { id: m.id, leadId: m.leadId, platform: 'EMAIL', direction: m.direction, status: m.status, sender: m.sender, content: m.content,
        isRead: m.direction === 'OUTBOUND', createdAt: daysAgo(m.ageDays) } });
  }
  for (const t of rows.tasks) {
    await prisma.task.upsert({ where: { id: t.id }, update: { title: t.title },
      create: { id: t.id, teamId, userId: owner.id, title: t.title, leadId: t.leadId, priority: t.priority, dueDate: daysAhead(t.dueInDays) } });
  }
  for (const m of rows.meetings) {
    const start = daysAhead(m.startInDays);
    await prisma.meeting.upsert({ where: { id: m.id }, update: { title: m.title, notes: m.notes },
      create: { id: m.id, teamId, leadId: m.leadId, title: m.title, startTime: start, endTime: new Date(start.getTime() + m.minutes * 60_000), notes: m.notes } });
  }
  for (const t of rows.templates) {
    await prisma.emailTemplate.upsert({ where: { id: t.id }, update: { name: t.name, subject: t.subject, body: t.body },
      create: { id: t.id, teamId, name: t.name, subject: t.subject, body: t.body } });
  }
  for (const k of rows.knowledgeBases) {
    await prisma.knowledgeBase.upsert({ where: { id: k.id }, update: { name: k.name, description: k.description },
      create: { id: k.id, teamId, name: k.name, description: k.description } });
  }
  for (const k of rows.knowledgeItems) {
    await prisma.knowledgeItem.upsert({ where: { id: k.id }, update: { content: k.content },
      create: { id: k.id, knowledgeBaseId: k.knowledgeBaseId, content: k.content, metadata: { source: 'teardown' } } });
  }
}

/**
 * Deletes every row in the tear-down team (the team is dedicated, so anything in it belongs to the tear-down),
 * keeps the Team row, and deactivates the owner's membership. That membership check is what stops any MCP
 * connection to this workspace from working. All or nothing: one transaction.
 */
export async function removeTeardown(prisma: PrismaClient, rows: TeardownRows, owner: Owner): Promise<void> {
  const { teamId } = rows;
  const leadIds = (await prisma.lead.findMany({ where: { teamId }, select: { id: true } })).map(l => l.id);
  const kbIds = (await prisma.knowledgeBase.findMany({ where: { teamId }, select: { id: true } })).map(k => k.id);
  await prisma.$transaction([
    prisma.message.deleteMany({ where: { leadId: { in: leadIds } } }),
    prisma.leadActivity.deleteMany({ where: { leadId: { in: leadIds } } }),
    prisma.task.deleteMany({ where: { teamId } }),
    prisma.meeting.deleteMany({ where: { teamId } }),
    prisma.lead.deleteMany({ where: { teamId } }),
    prisma.campaign.deleteMany({ where: { teamId } }),
    prisma.iCP.deleteMany({ where: { teamId } }),
    prisma.emailTemplate.deleteMany({ where: { teamId } }),
    prisma.knowledgeItem.deleteMany({ where: { knowledgeBaseId: { in: kbIds } } }),
    prisma.knowledgeBase.deleteMany({ where: { teamId } }),
    prisma.teamMember.updateMany({ where: { teamId, userId: owner.id }, data: { status: 'inactive' } }),
  ]);
}
