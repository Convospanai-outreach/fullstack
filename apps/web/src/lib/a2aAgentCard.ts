/**
 * A2A Protocol Agent Card
 * https://a2a-protocol.org/latest/specification/
 * https://a2a-protocol.org/latest/topics/agent-discovery/
 */

export interface AgentInterface {
    url: string;
    protocolBinding: string;
    protocolVersion: string;
    tenant?: string;
}

export interface AgentSkill {
    id: string;
    name: string;
    description: string;
    tags?: string[];
    examples?: string[];
}

export interface AgentCapabilities {
    streaming: boolean;
    pushNotifications: boolean;
    humanApprovalRequired?: boolean;
    extendedAgentCard?: boolean;
    [key: string]: unknown;
}

export interface A2AAgentCard {
    name: string;
    version: string;
    description: string;
    supportedInterfaces: AgentInterface[];
    capabilities: AgentCapabilities;
    skills: AgentSkill[];
    defaultInputModes?: string[];
    defaultOutputModes?: string[];
}

export function getBaseSiteUrl(): string {
    return (process.env['NEXT_PUBLIC_SITE_URL'] || process.env['NEXTAUTH_URL'] || 'https://craftmyfunnel.live').replace(/\/$/, '');
}

export function getA2AAgentCard(baseUrl?: string): A2AAgentCard {
    const origin = baseUrl || getBaseSiteUrl();

    return {
        name: 'CraftMyFunnel Outbound Governance Agent',
        version: '1.0.0',
        description:
            'Governed B2B outbound sales execution, automated lead pipeline management, human approval workflows, and deliverability orchestration agent.',
        supportedInterfaces: [
            {
                url: `${origin}/api/v1`,
                protocolBinding: 'HTTP+JSON',
                protocolVersion: '1.0',
            },
            {
                url: `${origin}/api/mcp`,
                protocolBinding: 'JSONRPC',
                protocolVersion: '2.0',
            },
        ],
        capabilities: {
            streaming: false,
            pushNotifications: true,
            humanApprovalRequired: true,
            extendedAgentCard: false,
        },
        skills: [
            {
                id: 'lead-management',
                name: 'B2B Lead Management & Verification',
                description:
                    'Ingests, deduplicates, verifies deliverability, and scopes B2B leads within isolated tenant workspaces.',
                tags: ['leads', 'enrichment', 'crm'],
            },
            {
                id: 'campaign-orchestration',
                name: 'Outbound Campaign Orchestration',
                description:
                    'Coordinates multi-step email cadences, sends outbound messages with RFC 8058 one-click unsubscribe, and records delivery telemetry.',
                tags: ['campaigns', 'email', 'outreach'],
            },
            {
                id: 'human-approval-governance',
                name: 'Human-in-the-Loop Review & Approval',
                description:
                    'Enforces strict human oversight before AI-drafted messages and outreach sequences are transmitted to prospects.',
                tags: ['governance', 'compliance', 'safety'],
            },
            {
                id: 'deliverability-monitoring',
                name: 'Mailbox Health & Deliverability Telemetry',
                description:
                    'Monitors SPF, DKIM, DMARC alignment, bounce thresholds, and feedback loop alerts across connected mailboxes.',
                tags: ['deliverability', 'dkim', 'reputation'],
            },
        ],
        defaultInputModes: ['application/json', 'text/plain'],
        defaultOutputModes: ['application/json', 'text/markdown'],
    };
}

export function getA2AAgentCardJson(baseUrl?: string): string {
    return JSON.stringify(getA2AAgentCard(baseUrl), null, 2);
}
