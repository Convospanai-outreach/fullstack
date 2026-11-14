import { describe, expect, it } from "vitest";
import { buildGovernanceLog, type ApprovalRecord, type AuditRecord } from "./campaignGovernanceLog";

const approval = (over: Partial<ApprovalRecord> = {}): ApprovalRecord => ({
    id: "req-1",
    actionType: "SEND_EMAIL",
    entityType: "Lead",
    status: "PENDING",
    payload: { subject: "Hello Priya", body: "secret draft text", to: "priya@example.com" },
    createdAt: new Date("2026-11-10T10:00:00Z"),
    reviewedAt: null,
    updatedAt: new Date("2026-11-10T10:00:00Z"),
    requester: { name: "Asha", email: "asha@team.example" },
    reviewer: null,
    ...over,
});

describe("buildGovernanceLog", () => {
    it("records a pending approval as one request row", () => {
        const rows = buildGovernanceLog([approval()], [], 50);
        expect(rows).toHaveLength(1);
        expect(rows[0]).toMatchObject({ actor: "Asha", requestId: "req-1", outcome: "Sent for review", action: "Requested approval: send email (lead)" });
    });

    it("never carries payload values, only field names", () => {
        const text = JSON.stringify(buildGovernanceLog([approval()], [], 50));
        expect(text).not.toContain("secret draft text");
        expect(text).not.toContain("priya@example.com");
        expect(text).not.toContain("Hello Priya");
        expect(buildGovernanceLog([approval()], [], 50)[0].argumentNames).toEqual(["body", "subject", "to"]);
    });

    it("adds a decision row with the reviewer and outcome, newest first", () => {
        const rows = buildGovernanceLog(
            [approval({ status: "APPROVED", reviewedAt: new Date("2026-11-10T11:00:00Z"), reviewer: { name: null, email: "lead@team.example" } })],
            [],
            50
        );
        expect(rows.map((r) => r.outcome)).toEqual(["Approved", "Sent for review"]);
        expect(rows[0].actor).toBe("lead@team.example");
    });

    it("marks a rejection with no reviewer as expired, attributed to the system", () => {
        const rows = buildGovernanceLog([approval({ status: "REJECTED", updatedAt: new Date("2026-11-10T12:00:00Z") })], [], 50);
        expect(rows[0]).toMatchObject({ actor: "System", outcome: "Rejected (expired without review)" });
    });

    it("includes campaign audit entries without their metadata values", () => {
        const audit: AuditRecord = {
            id: "a1", action: "UPDATE", correlationId: "corr-9", metadata: { name: "Q4 push" },
            createdAt: new Date("2026-11-11T09:00:00Z"), user: { name: "Asha", email: "asha@team.example" },
        };
        const rows = buildGovernanceLog([], [audit], 50);
        expect(rows[0]).toMatchObject({ action: "Campaign update", requestId: "corr-9", outcome: "Recorded", argumentNames: ["name"] });
        expect(JSON.stringify(rows)).not.toContain("Q4 push");
    });

    it("keeps only the newest rows up to the limit", () => {
        const many = Array.from({ length: 5 }, (_, i) => approval({ id: `r${i}`, createdAt: new Date(`2026-11-0${i + 1}T00:00:00Z`) }));
        expect(buildGovernanceLog(many, [], 2).map((r) => r.requestId)).toEqual(["r4", "r3"]);
    });
});
