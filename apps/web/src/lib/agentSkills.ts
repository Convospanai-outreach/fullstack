import crypto from 'crypto';

/**
 * Agent Skills Discovery RFC v0.2.0
 * https://github.com/cloudflare/agent-skills-discovery-rfc
 * https://schemas.agentskills.io/discovery/0.2.0/schema.json
 */

export interface AgentSkillEntry {
    name: string;
    type: 'skill-md' | 'archive';
    description: string;
    url: string;
    digest: string;
}

export interface AgentSkillsDiscoveryIndex {
    $schema: string;
    skills: AgentSkillEntry[];
}

export const SKILL_DEFINITIONS: Record<string, { description: string; markdown: string }> = {
    'b2b-lead-intake': {
        description: 'Ingest, validate deliverability, and import B2B sales leads into isolated workspace pipelines.',
        markdown: `---
name: b2b-lead-intake
description: Ingest, validate deliverability, and import B2B sales leads into isolated workspace pipelines.
version: 1.0.0
---

# B2B Lead Intake & Deliverability Verification

Instructions for autonomous AI agents to ingest, validate, and register B2B sales leads with CraftMyFunnel.

## Endpoint
\`POST /api/v1/leads\`

## Requirements
- Authenticate with \`Authorization: Bearer <API_KEY>\` or session cookie
- Provide lead details: \`email\`, \`firstName\`, \`lastName\`, \`company\`, \`title\`
- All leads are automatically checked against suppression lists and scoped to authenticated workspace
`,
    },
    'outreach-campaign-governance': {
        description: 'Orchestrate governed email campaigns, cadence sequencing, and RFC 8058 one-click unsubscribe compliance.',
        markdown: `---
name: outreach-campaign-governance
description: Orchestrate governed email campaigns, cadence sequencing, and RFC 8058 one-click unsubscribe compliance.
version: 1.0.0
---

# Outreach Campaign Governance

Instructions for managing multi-step outbound cadences and deliverability compliance.

## Endpoints
- \`GET /api/v1/campaigns\` - List active campaigns
- \`POST /api/email/unsubscribe/[trackingId]\` - RFC 8058 one-click unsubscribe handler

## Safety Constraints
- Respect daily mailbox send limits and warm-up pacing
- Include List-Unsubscribe headers on all outbound messages
`,
    },
    'human-in-the-loop-approvals': {
        description: 'Stage AI-drafted messages and sensitive sequence actions for mandatory human review and verification.',
        markdown: `---
name: human-in-the-loop-approvals
description: Stage AI-drafted messages and sensitive sequence actions for mandatory human review and verification.
version: 1.0.0
---

# Human-in-the-Loop Approvals

Enforce governance and oversight on outbound communications.

## Workflow
1. AI generates draft outreach messaging based on prospect intent signals
2. Draft is placed into the Approval Queue (\`/dashboard/approvals\`)
3. A verified team manager reviews, edits, or approves the transmission
4. No outbound transmission occurs without explicit human clearance
`,
    },
};

export function getBaseSiteUrl(): string {
    return (process.env['NEXT_PUBLIC_SITE_URL'] || process.env['NEXTAUTH_URL'] || 'https://craftmyfunnel.live').replace(/\/$/, '');
}

export function computeSha256Digest(content: string): string {
    const hex = crypto.createHash('sha256').update(content, 'utf8').digest('hex');
    return `sha256:${hex}`;
}

export function getAgentSkillContent(skillName: string): string | null {
    return SKILL_DEFINITIONS[skillName]?.markdown || null;
}

export function getAgentSkillsDiscoveryIndex(baseUrl?: string): AgentSkillsDiscoveryIndex {
    const origin = baseUrl || getBaseSiteUrl();

    const skills: AgentSkillEntry[] = Object.entries(SKILL_DEFINITIONS).map(([name, def]) => {
        return {
            name,
            type: 'skill-md',
            description: def.description,
            url: `${origin}/.well-known/agent-skills/${name}/SKILL.md`,
            digest: computeSha256Digest(def.markdown),
        };
    });

    return {
        $schema: 'https://schemas.agentskills.io/discovery/0.2.0/schema.json',
        skills,
    };
}

export function getAgentSkillsDiscoveryIndexJson(baseUrl?: string): string {
    return JSON.stringify(getAgentSkillsDiscoveryIndex(baseUrl), null, 2);
}
