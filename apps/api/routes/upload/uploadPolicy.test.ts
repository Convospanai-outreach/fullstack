import { beforeEach, describe, expect, it, vi } from "vitest";

// An org that has switched uploads off must not be able to get a file in through any upload route.

const { mockGetCurrentContext, mockEnforcePolicy, mockPrisma } = vi.hoisted(() => ({
    mockGetCurrentContext: vi.fn(),
    mockEnforcePolicy: vi.fn(),
    mockPrisma: {
        knowledgeBase: { findFirst: vi.fn(), create: vi.fn() },
        knowledgeItem: { create: vi.fn() },
    },
}));

vi.mock("@/lib/auth", () => ({ getCurrentContext: mockGetCurrentContext }));
vi.mock("@/lib/db", () => ({ prisma: mockPrisma }));
vi.mock("@/lib/governance/guard", () => ({ enforcePolicy: mockEnforcePolicy }));
vi.mock("@/lib/queue", () => ({ JobQueue: { enqueue: vi.fn() } }));

import { POST as uploadPdf } from "./pdf/route";
import { POST as uploadCsv } from "../csv-ingestion/upload/route";

function fileRequest(name: string, type: string) {
    const form = new FormData();
    form.append("file", new File(["a,b\n1,2\n"], name, { type }));
    return new Request("http://localhost/upload", { method: "POST", body: form }) as any;
}

describe("upload routes honour the org upload policy", () => {
    beforeEach(() => {
        vi.clearAllMocks();
        mockGetCurrentContext.mockResolvedValue({ userId: "user-1", teamId: "team-a" });
        mockEnforcePolicy.mockRejectedValue(new Error("UPLOADS_DISABLED_BY_ORG"));
    });

    it("POST /upload/pdf", async () => {
        const res = await uploadPdf(fileRequest("doc.pdf", "application/pdf"));

        expect(res.status).toBe(403);
        expect(mockEnforcePolicy).toHaveBeenCalledWith(expect.objectContaining({ orgId: "team-a", userId: "user-1", action: "UPLOAD" }));
        expect(mockPrisma.knowledgeItem.create).not.toHaveBeenCalled();
    });

    it("POST /csv-ingestion/upload", async () => {
        const res = await uploadCsv(fileRequest("leads.csv", "text/csv"));

        expect(res.status).toBe(403);
        expect(mockEnforcePolicy).toHaveBeenCalledWith(expect.objectContaining({ orgId: "team-a", userId: "user-1", action: "UPLOAD" }));
    });
});
