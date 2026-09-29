import { beforeEach, describe, expect, it, vi } from "vitest";

const { mockMoveLead, mockGetCurrentContext } = vi.hoisted(() => ({
    mockMoveLead: vi.fn(),
    mockGetCurrentContext: vi.fn(),
}));

vi.mock("@/lib/auth", () => ({ getCurrentContext: mockGetCurrentContext }));
vi.mock("@/modules/analytics/service/PipelineService", () => ({
    PIPELINE_STAGES: ["COLD", "WARM", "HOT", "COORDINATING", "MEETING_CONFIRMED", "COMPLETED"],
    PipelineService: { moveLead: mockMoveLead },
}));

import { PATCH } from "./route";

function patchRequest(body: unknown) {
    return new Request("http://localhost/pipeline/leads/lead-1", {
        method: "PATCH",
        body: JSON.stringify(body),
    }) as any;
}

const ctx = { params: Promise.resolve({ leadId: "lead-1" }) };

// roadmap 3.3 (S-10): the stage and dealValue went to moveLead/Prisma unchecked,
// so a bad stage or a string dealValue came back as a 500.
describe("PATCH /pipeline/leads/[leadId]", () => {
    beforeEach(() => {
        vi.clearAllMocks();
        mockGetCurrentContext.mockResolvedValue({ userId: "user-1", teamId: "team-1" });
        mockMoveLead.mockResolvedValue({ id: "lead-1" });
    });

    it("moves a lead to a real stage (the Kanban board's payload)", async () => {
        const res = await PATCH(patchRequest({ status: "HOT" }), ctx);

        expect(res.status).toBe(200);
        expect(mockMoveLead).toHaveBeenCalledWith("team-1", "lead-1", "HOT", undefined);
    });

    it("400s an unknown stage without calling moveLead", async () => {
        const res = await PATCH(patchRequest({ status: "CLOSED_WON" }), ctx);

        expect(res.status).toBe(400);
        expect(mockMoveLead).not.toHaveBeenCalled();
    });

    it("400s a non-numeric dealValue without calling moveLead", async () => {
        const res = await PATCH(patchRequest({ status: "HOT", dealValue: "5000" }), ctx);

        expect(res.status).toBe(400);
        expect(mockMoveLead).not.toHaveBeenCalled();
    });
});
