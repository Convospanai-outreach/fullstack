import { freeEmailChecks, verifyEmailAddress, type VerifyDeps, type VerifyResult } from "./emailStatus";

// Checking a batch of leads. A lead already VERIFIED or INVALID is not checked again, and one without an
// address has nothing to check. The plan says how many paid provider checks a run will use, so the person
// can agree to the cost before anything is spent.

export interface BatchLead {
    id: string;
    email: string | null;
    emailStatus: string;
}

const DONE = new Set(["VERIFIED", "INVALID"]);
const needsCheck = (l: BatchLead): l is BatchLead & { email: string } => !!l.email && !DONE.has(l.emailStatus);

export interface VerificationPlan {
    total: number;
    skipped: number;
    answeredFree: number;
    providerChecks: number;
}

export async function planEmailVerification(leads: BatchLead[], deps: VerifyDeps): Promise<VerificationPlan> {
    const todo = leads.filter(needsCheck);
    const free = await Promise.all(todo.map((l) => freeEmailChecks(l.email, deps)));
    const answeredFree = free.filter(Boolean).length;
    return { total: leads.length, skipped: leads.length - todo.length, answeredFree, providerChecks: todo.length - answeredFree };
}

export async function runEmailVerification(
    leads: BatchLead[],
    deps: VerifyDeps,
    save: (leadId: string, result: VerifyResult) => Promise<void>
): Promise<{ checked: number; providerChecks: number }> {
    let checked = 0;
    let providerChecks = 0;
    for (const lead of leads.filter(needsCheck)) {
        const result = await verifyEmailAddress(lead.email, deps);
        checked++;
        if (result.usedProvider) providerChecks++;
        // The provider could not answer: keep whatever the lead had rather than overwrite it with "unknown".
        if (result.usedProvider && result.status === "UNKNOWN") continue;
        await save(lead.id, result);
    }
    return { checked, providerChecks };
}
