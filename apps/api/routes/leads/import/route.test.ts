import { beforeEach, describe, expect, it, vi } from "vitest";

const { mockGetCurrentContext, mockProcessCSV, mockCsvImportLimiter, mockAuthorizeRole } = vi.hoisted(() => ({
    mockGetCurrentContext: vi.fn(),
    mockProcessCSV: vi.fn(),
    mockCsvImportLimiter: { check: vi.fn() },
    mockAuthorizeRole: vi.fn(),
}));

vi.mock("@/lib/auth", () => ({ getCurrentContext: mockGetCurrentContext }));
vi.mock("@/modules/csv-ingestion/service/csvIngestionService", () => ({
    csvIngestionService: { processCSV: mockProcessCSV },
}));
vi.mock("@/lib/rate-limit", () => ({ csvImportLimiter: mockCsvImportLimiter }));
vi.mock("@/lib/permissions", () => ({
    authorizeRole: mockAuthorizeRole,
    TeamRole: { OWNER: "OWNER", ADMIN: "ADMIN", MEMBER: "MEMBER", VIEWER: "VIEWER" },
}));

import { POST } from "./route";

function textRequest(body: string) {
    return new Request("http://localhost/leads/import", { method: "POST", body });
}

describe("POST /leads/import - rate limiting", () => {
    beforeEach(() => {
        vi.clearAllMocks();
        mockGetCurrentContext.mockResolvedValue({ userId: "user-1", teamId: "team-1" });
        mockProcessCSV.mockResolvedValue({ success: true, created: 1, skipped: 0, errors: [], totalParsed: 1, inserted: 1 });
        mockAuthorizeRole.mockResolvedValue(undefined);
    });

    it("processes the import when under the rate limit", async () => {
        mockCsvImportLimiter.check.mockReturnValue({ isRateLimited: false, currentUsage: 1 });

        const res = await POST(textRequest("email\na@b.com\n"));

        expect(mockCsvImportLimiter.check).toHaveBeenCalledWith(3, "team-1");
        expect(mockProcessCSV).toHaveBeenCalled();
        expect(res.status).toBe(200);
    });

    it("429s and never processes the CSV once the team's import rate is exceeded", async () => {
        mockCsvImportLimiter.check.mockReturnValue({ isRateLimited: true, currentUsage: 4 });

        const res = await POST(textRequest("email\na@b.com\n"));

        expect(res.status).toBe(429);
        expect(mockProcessCSV).not.toHaveBeenCalled();
    });

    it("OPEN-208: rejects a caller below MEMBER role (e.g. a read-only VIEWER) before processing any CSV", async () => {
        const { APIError } = await import("@/lib/apiResponse");
        mockAuthorizeRole.mockRejectedValue(new APIError("Insufficient permissions", 403));
        mockCsvImportLimiter.check.mockReturnValue({ isRateLimited: false, currentUsage: 1 });

        const res = await POST(textRequest("email\na@b.com\n"));

        expect(res.status).toBe(403);
        expect(mockProcessCSV).not.toHaveBeenCalled();
    });
});
