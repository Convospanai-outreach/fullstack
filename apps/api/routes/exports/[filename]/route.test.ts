import { describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import { GET } from "./route";

vi.mock("@/lib/auth", () => ({
    getCurrentContextFromRequest: vi.fn().mockResolvedValue({
        userId: "user-123",
        teamId: "team-A"
    })
}));

// Mock fs to always return false for existsSync so we test only the auth logic
vi.mock("fs", () => ({
    default: {
        existsSync: vi.fn().mockReturnValue(false),
        readFileSync: vi.fn().mockReturnValue(Buffer.from(""))
    }
}));

function createRequest() {
    return new NextRequest("http://localhost:3001/api/exports/some-file.csv");
}

describe("GET /api/exports/[filename]", () => {
    it("rejects download if filename does not start with teamId (Horizontal Privilege Escalation check)", async () => {
        const req = createRequest();
        
        // Simulating request for team B's file
        const response = await GET(req, { params: Promise.resolve({ filename: "team-B_leads.csv" }) });
        
        expect(response.status).toBe(403);
    });

    it("allows download if filename starts with user's teamId prefix", async () => {
        const req = createRequest();
        
        // Simulating request for user's own team file
        const response = await GET(req, { params: Promise.resolve({ filename: "team-A_leads.csv" }) });
        
        // Should return 404 since we mocked fs.existsSync to return false, 
        // which proves it bypassed the 403 Forbidden check.
        expect(response.status).toBe(404);
    });
});
