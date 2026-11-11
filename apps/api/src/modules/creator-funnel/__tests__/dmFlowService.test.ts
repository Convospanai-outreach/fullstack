import { beforeEach, describe, expect, it, vi } from "vitest";

const mockDb: any = vi.hoisted(() => ({
    dmFlow: { create: vi.fn(), findFirst: vi.fn(), findMany: vi.fn(), updateMany: vi.fn(), update: vi.fn() },
    leadProperty: { findMany: vi.fn() },
}));
const audit = vi.hoisted(() => vi.fn());

vi.mock("@/lib/db", () => ({ prisma: mockDb }));
vi.mock("@/modules/audit/auditService", () => ({ AuditService: { log: audit } }));

import { archiveDmFlow, createDmFlow, getDmFlowForAttach, listDmFlows, updateDmFlow } from "../dmFlowService";

const TEAM = "team-a";
const USER = "user-1";
const steps = [
    { type: "message", text: "Hi, thanks for asking" },
    { type: "question", text: "What is your budget?", property: "budget" },
    { type: "link", text: "Here is the guide" },
    { type: "end" },
];

beforeEach(() => {
    vi.clearAllMocks();
    mockDb.leadProperty.findMany.mockResolvedValue([{ key: "budget" }]);
    mockDb.dmFlow.create.mockImplementation(async ({ data }: any) => ({ id: "flow-1", ...data }));
});

describe("createDmFlow", () => {
    it("saves the validated steps for the team and writes an audit row", async () => {
        const flow = await createDmFlow(TEAM, USER, { name: "Guide", steps });
        expect(mockDb.dmFlow.create).toHaveBeenCalledWith({
            data: expect.objectContaining({ teamId: TEAM, name: "Guide", steps, version: 1, createdById: USER }),
        });
        expect(flow.id).toBe("flow-1");
        expect(audit).toHaveBeenCalledWith(TEAM, USER, "DM_FLOW_CREATE", "DmFlow", "flow-1", expect.any(Object));
    });

    it("rejects invalid steps before touching the database", async () => {
        await expect(createDmFlow(TEAM, USER, { name: "Bad", steps: [] })).rejects.toMatchObject({ status: 400 });
        expect(mockDb.dmFlow.create).not.toHaveBeenCalled();
    });

    it("rejects a question whose property does not exist for this team", async () => {
        mockDb.leadProperty.findMany.mockResolvedValue([]);
        await expect(createDmFlow(TEAM, USER, { name: "Guide", steps })).rejects.toMatchObject({ status: 400 });
        expect(mockDb.leadProperty.findMany).toHaveBeenCalledWith({
            where: { teamId: TEAM, archivedAt: null, key: { in: ["budget"] } },
            select: { key: true },
        });
        expect(mockDb.dmFlow.create).not.toHaveBeenCalled();
    });

    it("rejects an empty name", async () => {
        await expect(createDmFlow(TEAM, USER, { name: "   ", steps })).rejects.toMatchObject({ status: 400 });
    });
});

describe("updateDmFlow", () => {
    it("is team-scoped and bumps the version when the steps change", async () => {
        mockDb.dmFlow.findFirst.mockResolvedValue({ id: "flow-1", teamId: TEAM, name: "Guide", steps, version: 3, archivedAt: null });
        mockDb.dmFlow.update.mockImplementation(async ({ data }: any) => ({ id: "flow-1", ...data }));
        await updateDmFlow(TEAM, USER, "flow-1", { steps: [{ type: "message", text: "Changed" }, { type: "end" }] });
        expect(mockDb.dmFlow.findFirst).toHaveBeenCalledWith(expect.objectContaining({ where: { id: "flow-1", teamId: TEAM, archivedAt: null } }));
        expect(mockDb.dmFlow.update).toHaveBeenCalledWith({
            where: { id: "flow-1" },
            data: expect.objectContaining({ version: { increment: 1 }, steps: [{ type: "message", text: "Changed" }, { type: "end" }] }),
        });
    });

    it("returns 404 when the flow is not in this team", async () => {
        mockDb.dmFlow.findFirst.mockResolvedValue(null);
        await expect(updateDmFlow(TEAM, USER, "flow-9", { name: "x" })).rejects.toMatchObject({ status: 404 });
        expect(mockDb.dmFlow.update).not.toHaveBeenCalled();
    });
});

describe("listDmFlows and archiveDmFlow", () => {
    it("lists only the team's active flows", async () => {
        mockDb.dmFlow.findMany.mockResolvedValue([]);
        await listDmFlows(TEAM);
        expect(mockDb.dmFlow.findMany).toHaveBeenCalledWith(expect.objectContaining({ where: { teamId: TEAM, archivedAt: null } }));
    });

    it("archives only a flow of this team and returns 404 otherwise", async () => {
        mockDb.dmFlow.updateMany.mockResolvedValueOnce({ count: 0 });
        await expect(archiveDmFlow(TEAM, USER, "flow-9")).rejects.toMatchObject({ status: 404 });
        expect(mockDb.dmFlow.updateMany).toHaveBeenCalledWith({
            where: { id: "flow-9", teamId: TEAM, archivedAt: null },
            data: { archivedAt: expect.any(Date) },
        });
    });
});

describe("getDmFlowForAttach", () => {
    it("returns the team's active flow", async () => {
        mockDb.dmFlow.findFirst.mockResolvedValue({ id: "flow-1", steps });
        expect(await getDmFlowForAttach(TEAM, "flow-1", { landingPageId: "page-1" })).toMatchObject({ id: "flow-1" });
        expect(mockDb.dmFlow.findFirst).toHaveBeenCalledWith(expect.objectContaining({ where: { id: "flow-1", teamId: TEAM, archivedAt: null } }));
    });

    it("refuses a link step when the trigger has no landing page", async () => {
        mockDb.dmFlow.findFirst.mockResolvedValue({ id: "flow-1", steps });
        await expect(getDmFlowForAttach(TEAM, "flow-1", { landingPageId: null })).rejects.toMatchObject({ status: 400 });
        expect(await getDmFlowForAttach(TEAM, "flow-1", { landingPageId: "page-1" })).toMatchObject({ id: "flow-1" });
    });
});
