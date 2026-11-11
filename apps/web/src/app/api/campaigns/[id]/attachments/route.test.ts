import { beforeEach, describe, expect, it, vi } from "vitest";

const { mockPrisma } = vi.hoisted(() => ({
    mockPrisma: {
        campaign: { findFirst: vi.fn() },
        campaignAttachment: { create: vi.fn(), findMany: vi.fn(), deleteMany: vi.fn() },
    },
}));

vi.mock("@/lib/auth", () => ({
    getCurrentContext: vi.fn().mockResolvedValue({ userId: "user-1", teamId: "team-1" }),
}));
vi.mock("@/lib/permissions", () => ({
    authorizeRole: vi.fn().mockResolvedValue(undefined),
    TeamRole: { VIEWER: "viewer", MEMBER: "member" },
}));
vi.mock("@/lib/db", () => ({ prisma: mockPrisma }));

const PDF = Buffer.concat([Buffer.from("%PDF-1.7\n"), Buffer.alloc(64, 0x20)]);
const PPTX = Buffer.concat([
    Buffer.from([0x50, 0x4b, 0x03, 0x04]),
    Buffer.from("[Content_Types].xml ppt/presentation.xml"),
]);
const PPT = Buffer.concat([
    Buffer.from([0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1]),
    Buffer.alloc(32),
    Buffer.from("PowerPoint Document", "utf16le"),
]);
const EXE = Buffer.concat([Buffer.from("MZ"), Buffer.alloc(64)]);
const PLAIN_ZIP = Buffer.concat([Buffer.from([0x50, 0x4b, 0x03, 0x04]), Buffer.from("payload/run.exe")]);

function upload(filename: string, mimeType: string, content: string) {
    return new Request("http://localhost/api/campaigns/camp-1/attachments", {
        method: "POST",
        body: JSON.stringify({ filename, mimeType, content }),
    });
}
const params = { params: Promise.resolve({ id: "camp-1" }) };

describe("POST /api/campaigns/[id]/attachments - content checks", () => {
    beforeEach(() => {
        vi.clearAllMocks();
        mockPrisma.campaign.findFirst.mockResolvedValue({ id: "camp-1", teamId: "team-1" });
        mockPrisma.campaignAttachment.create.mockImplementation(({ data }: any) => Promise.resolve({ id: "att-1", ...data }));
    });

    it.each([
        ["brochure.pdf", "application/pdf", PDF],
        ["deck.pptx", "application/vnd.openxmlformats-officedocument.presentationml.presentation", PPTX],
        ["deck.ppt", "application/vnd.ms-powerpoint", PPT],
    ])("accepts a real %s and records its decoded size", async (filename, mimeType, bytes) => {
        const { POST } = await import("./route");

        const response = await POST(upload(filename, mimeType, bytes.toString("base64")), params);

        expect(response.status).toBe(201);
        expect(mockPrisma.campaignAttachment.create).toHaveBeenCalledWith(
            expect.objectContaining({ data: expect.objectContaining({ sizeBytes: bytes.length }) })
        );
    });

    it("accepts a PDF with a few bytes before its header, as PDF readers do", async () => {
        const { POST } = await import("./route");

        const leading = Buffer.concat([Buffer.from([0xef, 0xbb, 0xbf, 0x0a]), PDF]);
        const response = await POST(upload("brochure.pdf", "application/pdf", leading.toString("base64")), params);

        expect(response.status).toBe(201);
    });

    it("refuses an executable that claims to be a PDF", async () => {
        const { POST } = await import("./route");

        const response = await POST(upload("brochure.pdf", "application/pdf", EXE.toString("base64")), params);

        expect(response.status).toBe(400);
        expect(mockPrisma.campaignAttachment.create).not.toHaveBeenCalled();
    });

    it("refuses an arbitrary zip that claims to be a PowerPoint file", async () => {
        const { POST } = await import("./route");

        const response = await POST(
            upload("deck.pptx", "application/vnd.openxmlformats-officedocument.presentationml.presentation", PLAIN_ZIP.toString("base64")),
            params
        );

        expect(response.status).toBe(400);
        expect(mockPrisma.campaignAttachment.create).not.toHaveBeenCalled();
    });

    it.each(["brochure.pdf.exe", "brochure.scr", "brochure"])(
        "refuses a real PDF whose filename is %s",
        async (filename) => {
            const { POST } = await import("./route");

            const response = await POST(upload(filename, "application/pdf", PDF.toString("base64")), params);

            expect(response.status).toBe(400);
            expect(mockPrisma.campaignAttachment.create).not.toHaveBeenCalled();
        }
    );

    it("refuses content that is not plain base64, so it cannot break out of its MIME part", async () => {
        const { POST } = await import("./route");

        const content = `${PDF.toString("base64")}\r\n--boundary\r\nContent-Type: text/html\r\n\r\n<p>hi</p>`;
        const response = await POST(upload("brochure.pdf", "application/pdf", content), params);

        expect(response.status).toBe(400);
        expect(mockPrisma.campaignAttachment.create).not.toHaveBeenCalled();
    });
});
