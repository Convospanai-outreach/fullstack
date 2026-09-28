import { beforeEach, describe, expect, it, vi } from "vitest";

// Roadmap 3.5 / S-14: /api/upload/csv read the whole body (req.text()/req.json())
// with no size limit. Cap is 10 MiB, matching apps/api's MAX_CSV_UPLOAD_BYTES.
const CAP = 10 * 1024 * 1024;

const { mockGetCurrentContext, mockPrisma } = vi.hoisted(() => ({
    mockGetCurrentContext: vi.fn(),
    mockPrisma: {
        lead: { findFirst: vi.fn(), update: vi.fn(), create: vi.fn(), count: vi.fn() },
        campaign: { findFirst: vi.fn(), update: vi.fn() },
    },
}));

vi.mock("@/lib/auth", () => ({ getCurrentContext: mockGetCurrentContext }));
vi.mock("@/lib/db", () => ({ prisma: mockPrisma }));

import { POST } from "@/app/api/upload/csv/route";

/** A body stream that yields `total` bytes and records how much was pulled. */
function countingStream(total: number) {
    const state = { pulled: 0 };
    const chunk = new TextEncoder().encode("a".repeat(64 * 1024));
    const stream = new ReadableStream<Uint8Array>({
        pull(controller) {
            if (state.pulled >= total) {
                controller.close();
                return;
            }
            state.pulled += chunk.byteLength;
            controller.enqueue(chunk);
        },
    });
    return { stream, state };
}

function streamedRequest(stream: ReadableStream<Uint8Array>, headers: Record<string, string> = {}) {
    return new Request("http://localhost/api/upload/csv", {
        method: "POST",
        headers: { "content-type": "text/csv", ...headers },
        body: stream,
        duplex: "half",
    } as RequestInit) as any;
}

describe("POST /api/upload/csv size cap", () => {
    beforeEach(() => {
        vi.clearAllMocks();
        mockGetCurrentContext.mockResolvedValue({ userId: "user-1", teamId: "team-a" });
        mockPrisma.lead.findFirst.mockResolvedValue(null);
        mockPrisma.lead.create.mockResolvedValue({ id: "lead-1" });
    });

    it("rejects a declared Content-Length over the cap with 413 before reading the body", async () => {
        const { stream, state } = countingStream(CAP + 1);
        const res = await POST(streamedRequest(stream, { "content-length": String(CAP + 1) }));

        expect(res.status).toBe(413);
        expect(state.pulled).toBeLessThan(CAP);
        expect(mockPrisma.lead.create).not.toHaveBeenCalled();
    });

    it("rejects an oversized body with no Content-Length (chunked) with 413, stopping at the cap", async () => {
        const { stream, state } = countingStream(CAP * 3);
        const res = await POST(streamedRequest(stream));

        expect(res.status).toBe(413);
        expect(state.pulled).toBeLessThan(CAP * 2);
        expect(mockPrisma.lead.create).not.toHaveBeenCalled();
    });

    it("rejects an oversized JSON body too", async () => {
        const res = await POST(
            new Request("http://localhost/api/upload/csv", {
                method: "POST",
                headers: { "content-type": "application/json" },
                body: JSON.stringify({ csv: `email\n${"a".repeat(CAP)}@example.com` }),
            }) as any
        );

        expect(res.status).toBe(413);
        expect(mockPrisma.lead.create).not.toHaveBeenCalled();
    });

    it("caps the CSV inside a JSON body, not the JSON envelope around it", async () => {
        // ~8 MiB of CSV whose quotes JSON-escape to ~16 MiB: under the cap as a CSV,
        // over it as a JSON body.
        const csv = `email,note\nfoo@example.com,"${'""'.repeat(Math.floor(CAP * 0.4))}"\n`;
        const body = JSON.stringify({ csv });
        expect(Buffer.byteLength(csv)).toBeLessThan(CAP);
        expect(Buffer.byteLength(body)).toBeGreaterThan(CAP);

        const res = await POST(
            new Request("http://localhost/api/upload/csv", {
                method: "POST",
                headers: { "content-type": "application/json" },
                body,
            }) as any
        );

        expect(res.status).toBe(200);
        expect(await res.json()).toMatchObject({ success: true, created: 1 });
    });

    it("still imports a CSV under the cap (text and JSON bodies)", async () => {
        const text = await POST(
            new Request("http://localhost/api/upload/csv", {
                method: "POST",
                headers: { "content-type": "text/csv" },
                body: "email\nfoo@example.com",
            }) as any
        );
        const json = await POST(
            new Request("http://localhost/api/upload/csv", {
                method: "POST",
                headers: { "content-type": "application/json" },
                body: JSON.stringify({ csv: "email\nbar@example.com" }),
            }) as any
        );

        expect(text.status).toBe(200);
        expect(await text.json()).toMatchObject({ success: true, created: 1 });
        expect(json.status).toBe(200);
        expect(await json.json()).toMatchObject({ success: true, created: 1 });
    });
});
