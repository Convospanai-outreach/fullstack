// Read-only governance trail for one campaign: approvals asked for and decided (for the campaign
// and its leads) and audit entries on the campaign. It carries who, what and the outcome, and never
// message content or lead details: approval payloads and audit metadata are reduced to field names.

export interface GovernanceRow {
    id: string;
    at: string;
    actor: string;
    action: string;
    /** Names of the fields that were put in front of the reviewer or recorded, never their values. */
    argumentNames: string[];
    requestId: string | null;
    outcome: string;
}

interface Person {
    name: string | null;
    email: string;
}

export interface ApprovalRecord {
    id: string;
    actionType: string;
    entityType: string;
    status: string;
    payload: unknown;
    createdAt: Date;
    reviewedAt: Date | null;
    updatedAt: Date;
    requester: Person | null;
    reviewer: Person | null;
}

export interface AuditRecord {
    id: string;
    action: string;
    correlationId: string | null;
    metadata: unknown;
    createdAt: Date;
    user: Person | null;
}

const person = (p: Person | null) => p?.name || p?.email || "System";
const fieldNames = (value: unknown) => (value && typeof value === "object" && !Array.isArray(value) ? Object.keys(value).sort() : []);
const readable = (action: string) => action.replaceAll("_", " ").toLowerCase();

export function buildGovernanceLog(approvals: ApprovalRecord[], audits: AuditRecord[], limit: number): GovernanceRow[] {
    const rows: GovernanceRow[] = [];

    for (const a of approvals) {
        const subject = a.entityType === "Lead" ? "lead" : "campaign";
        const argumentNames = fieldNames(a.payload);
        rows.push({
            id: `${a.id}:requested`,
            at: a.createdAt.toISOString(),
            actor: person(a.requester),
            action: `Requested approval: ${readable(a.actionType)} (${subject})`,
            argumentNames,
            requestId: a.id,
            outcome: "Sent for review",
        });
        if (a.status !== "PENDING") {
            rows.push({
                id: `${a.id}:decided`,
                at: (a.reviewedAt ?? a.updatedAt).toISOString(),
                // A rejection with no reviewer is the expiry sweep, not a person.
                actor: person(a.reviewer),
                action: `Reviewed: ${readable(a.actionType)} (${subject})`,
                argumentNames,
                requestId: a.id,
                outcome: a.status === "APPROVED" ? "Approved" : a.reviewer ? "Rejected" : "Rejected (expired without review)",
            });
        }
    }

    for (const log of audits) {
        rows.push({
            id: log.id,
            at: log.createdAt.toISOString(),
            actor: person(log.user),
            action: `Campaign ${readable(log.action)}`,
            argumentNames: fieldNames(log.metadata),
            requestId: log.correlationId,
            outcome: "Recorded",
        });
    }

    return rows.sort((x, y) => y.at.localeCompare(x.at)).slice(0, limit);
}
