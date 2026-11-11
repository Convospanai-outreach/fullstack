import { beforeEach, describe, expect, it, vi } from "vitest";

const { mockPrisma, mockAuditLog } = vi.hoisted(() => ({
    mockPrisma: {
        leadProperty: { count: vi.fn(), create: vi.fn(), findMany: vi.fn(), updateMany: vi.fn() },
        lead: { findFirst: vi.fn(), updateMany: vi.fn() },
    },
    mockAuditLog: vi.fn().mockResolvedValue(undefined),
}));

vi.mock("@/lib/db", () => ({ prisma: mockPrisma }));
vi.mock("@/modules/audit/auditService", () => ({ AuditService: { log: mockAuditLog } }));

import {
    archiveLeadProperty,
    createLeadProperty,
    listLeadProperties,
    renameLeadProperty,
    updateLeadCustomFields,
} from "./leadPropertyService";

const TEAM = "team-1";
const USER = "user-1";

function uniqueViolation() {
    return Object.assign(new Error("Unique constraint failed"), { code: "P2002" });
}

describe("createLeadProperty", () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it("creates a team-scoped definition and audits it without any lead values", async () => {
        mockPrisma.leadProperty.count.mockResolvedValue(3);
        mockPrisma.leadProperty.create.mockResolvedValue({ id: "prop-1", key: "budget", label: "Budget", type: "number" });

        const created = await createLeadProperty(TEAM, USER, { key: "budget", label: "Budget", type: "number" });

        expect(created.id).toBe("prop-1");
        expect(mockPrisma.leadProperty.count).toHaveBeenCalledWith({ where: { teamId: TEAM } });
        expect(mockPrisma.leadProperty.create).toHaveBeenCalledWith({
            data: { teamId: TEAM, key: "budget", label: "Budget", type: "number" },
        });
        expect(mockAuditLog).toHaveBeenCalledWith(
            TEAM,
            USER,
            "LEAD_PROPERTY_CREATE",
            "LeadProperty",
            "prop-1",
            { key: "budget", label: "Budget", type: "number" },
        );
    });

    it("stores choice options", async () => {
        mockPrisma.leadProperty.count.mockResolvedValue(0);
        mockPrisma.leadProperty.create.mockResolvedValue({ id: "prop-2" });

        await createLeadProperty(TEAM, USER, { key: "plan", label: "Plan", type: "choice", options: ["starter", "pro"] });

        expect(mockPrisma.leadProperty.create).toHaveBeenCalledWith({
            data: { teamId: TEAM, key: "plan", label: "Plan", type: "choice", options: ["starter", "pro"] },
        });
    });

    it("refuses a 51st property, counting archived ones too", async () => {
        mockPrisma.leadProperty.count.mockResolvedValue(50);

        await expect(createLeadProperty(TEAM, USER, { key: "budget", label: "Budget", type: "number" })).rejects.toMatchObject({
            statusCode: 400,
        });
        expect(mockPrisma.leadProperty.create).not.toHaveBeenCalled();
    });

    it("answers 409 when the key already exists for the team", async () => {
        mockPrisma.leadProperty.count.mockResolvedValue(1);
        mockPrisma.leadProperty.create.mockRejectedValue(uniqueViolation());

        await expect(createLeadProperty(TEAM, USER, { key: "budget", label: "Budget", type: "number" })).rejects.toMatchObject({
            statusCode: 409,
        });
    });

    it("rejects an invalid key or type before touching the database", async () => {
        await expect(createLeadProperty(TEAM, USER, { key: "Bad Key", label: "X", type: "text" })).rejects.toMatchObject({ statusCode: 400 });
        await expect(createLeadProperty(TEAM, USER, { key: "email", label: "X", type: "text" })).rejects.toMatchObject({ statusCode: 400 });
        await expect(createLeadProperty(TEAM, USER, { key: "x", label: "X", type: "select" })).rejects.toMatchObject({ statusCode: 400 });
        expect(mockPrisma.leadProperty.create).not.toHaveBeenCalled();
    });
});

describe("renameLeadProperty and archiveLeadProperty", () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it("renames only inside the caller's team", async () => {
        mockPrisma.leadProperty.updateMany.mockResolvedValue({ count: 1 });

        await renameLeadProperty(TEAM, USER, "prop-1", "Monthly budget");

        expect(mockPrisma.leadProperty.updateMany).toHaveBeenCalledWith({
            where: { id: "prop-1", teamId: TEAM },
            data: { label: "Monthly budget" },
        });
    });

    it("404s a property that belongs to another team", async () => {
        mockPrisma.leadProperty.updateMany.mockResolvedValue({ count: 0 });

        await expect(renameLeadProperty(TEAM, USER, "prop-9", "X")).rejects.toMatchObject({ statusCode: 404 });
    });

    it("archives by setting archivedAt, never by deleting the row", async () => {
        mockPrisma.leadProperty.updateMany.mockResolvedValue({ count: 1 });

        await archiveLeadProperty(TEAM, USER, "prop-1");

        expect(mockPrisma.leadProperty.updateMany).toHaveBeenCalledWith({
            where: { id: "prop-1", teamId: TEAM, archivedAt: null },
            data: { archivedAt: expect.any(Date) },
        });
        expect(mockPrisma.leadProperty).not.toHaveProperty("delete");
        expect(mockAuditLog).toHaveBeenCalledWith(TEAM, USER, "LEAD_PROPERTY_ARCHIVE", "LeadProperty", "prop-1", {});
    });
});

describe("listLeadProperties", () => {
    it("hides archived properties unless asked, and is team-scoped", async () => {
        mockPrisma.leadProperty.findMany.mockResolvedValue([]);

        await listLeadProperties(TEAM);

        expect(mockPrisma.leadProperty.findMany).toHaveBeenCalledWith({
            where: { teamId: TEAM, archivedAt: null },
            orderBy: { createdAt: "asc" },
        });
    });
});

describe("updateLeadCustomFields", () => {
    beforeEach(() => {
        vi.clearAllMocks();
        mockPrisma.leadProperty.findMany.mockResolvedValue([
            { key: "budget", type: "number", options: null, archivedAt: null },
            { key: "notes", type: "text", options: null, archivedAt: null },
        ]);
    });

    it("merges validated values into the lead's existing customFields", async () => {
        mockPrisma.lead.findFirst.mockResolvedValue({ customFields: { notes: "old" } });
        mockPrisma.lead.updateMany.mockResolvedValue({ count: 1 });

        const saved = await updateLeadCustomFields(TEAM, USER, "lead-1", { budget: "300" });

        expect(saved).toEqual({ budget: 300, notes: "old" });
        expect(mockPrisma.lead.updateMany).toHaveBeenCalledWith({
            where: { id: "lead-1", teamId: TEAM },
            data: { customFields: { budget: 300, notes: "old" } },
        });
    });

    it("rejects an unknown key and writes nothing", async () => {
        mockPrisma.lead.findFirst.mockResolvedValue({ customFields: null });

        await expect(updateLeadCustomFields(TEAM, USER, "lead-1", { mystery: "x" })).rejects.toMatchObject({ statusCode: 400 });
        expect(mockPrisma.lead.updateMany).not.toHaveBeenCalled();
    });

    it("404s a lead in another team before validating anything", async () => {
        mockPrisma.lead.findFirst.mockResolvedValue(null);

        await expect(updateLeadCustomFields(TEAM, USER, "lead-9", { budget: "1" })).rejects.toMatchObject({ statusCode: 404 });
        expect(mockPrisma.lead.findFirst).toHaveBeenCalledWith({ where: { id: "lead-9", teamId: TEAM }, select: { customFields: true } });
    });

    it("audits the keys changed, never the values", async () => {
        mockPrisma.lead.findFirst.mockResolvedValue({ customFields: null });
        mockPrisma.lead.updateMany.mockResolvedValue({ count: 1 });

        await updateLeadCustomFields(TEAM, USER, "lead-1", { notes: "private text" });

        const details = mockAuditLog.mock.calls.map((call) => JSON.stringify(call)).join(" ");
        expect(details).not.toContain("private text");
    });
});
