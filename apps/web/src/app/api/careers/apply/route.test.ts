import { beforeEach, describe, expect, it, vi } from "vitest";

const { create, getOpenJob, looksLikeBot, verifyTurnstile, checkRateLimit } = vi.hoisted(() => ({
    create: vi.fn(),
    getOpenJob: vi.fn(),
    looksLikeBot: vi.fn(),
    verifyTurnstile: vi.fn(),
    checkRateLimit: vi.fn(),
}));

vi.mock("@/lib/db", () => ({ prisma: { jobApplication: { create } } }));
vi.mock("@/lib/careers", () => ({ getJobBySlug: getOpenJob }));
vi.mock("@/lib/botCheck", () => ({ looksLikeBot, verifyTurnstile, clientIpFromRequest: () => "203.0.113.9" }));
vi.mock("@/lib/rateLimit", () => ({ checkRateLimit }));

import { POST } from "./route";

const pdf = () => new File([Buffer.from("%PDF-1.7 resume")], "cv.pdf", { type: "application/pdf" });

function apply(fields: Record<string, string | File | undefined> = {}) {
    const form = new FormData();
    const all: Record<string, string | File | undefined> = {
        jobSlug: "sdr",
        name: "Ada Lovelace",
        email: "ada@example.com",
        phone: "+91 98765 43210",
        coverNote: "I would love to join.",
        elapsedMs: "9000",
        website: "",
        resume: pdf(),
        ...fields,
    };
    for (const [key, value] of Object.entries(all)) if (value !== undefined) form.append(key, value);
    return POST(new Request("http://localhost/api/careers/apply", { method: "POST", body: form }));
}

describe("POST /api/careers/apply", () => {
    beforeEach(() => {
        vi.clearAllMocks();
        getOpenJob.mockReturnValue({ slug: "sdr", title: "Sales Development Rep", open: true });
        looksLikeBot.mockReturnValue(false);
        verifyTurnstile.mockResolvedValue(true);
        checkRateLimit.mockResolvedValue({ allowed: true });
        create.mockResolvedValue({ id: "app-1" });
    });

    it("saves the application with the resume and the job's title, and does not echo it back", async () => {
        const res = await apply();
        const body = await res.json();

        expect(res.status).toBe(201);
        expect(body).toEqual({ success: true });
        const data = create.mock.calls[0]![0].data;
        expect(data).toMatchObject({
            jobSlug: "sdr",
            jobTitle: "Sales Development Rep",
            name: "Ada Lovelace",
            email: "ada@example.com",
            phone: "+91 98765 43210",
            coverNote: "I would love to join.",
            resumeName: "cv.pdf",
            resumeType: "application/pdf",
        });
        expect(Buffer.isBuffer(data.resumeData)).toBe(true);
        expect(data.resumeSize).toBe(data.resumeData.length);
    });

    it("refuses an application for a position that is not open", async () => {
        getOpenJob.mockReturnValue(undefined);

        const res = await apply({ jobSlug: "gone" });

        expect(res.status).toBe(404);
        expect(create).not.toHaveBeenCalled();
    });

    it.each([
        ["a missing name", { name: "" }],
        ["an invalid email", { email: "nope" }],
        ["a missing resume", { resume: undefined }],
        ["a cover note over 4000 characters", { coverNote: "x".repeat(4001) }],
        ["a resume that is not a document", { resume: new File([Buffer.from("<script>")], "cv.pdf") }],
        ["an executable", { resume: new File([Buffer.from("MZ")], "cv.exe") }],
    ])("refuses %s without saving", async (_label, fields) => {
        const res = await apply(fields as any);

        expect(res.status).toBe(400);
        expect(create).not.toHaveBeenCalled();
    });

    it("looks like a success to a bot, and saves nothing", async () => {
        looksLikeBot.mockReturnValue(true);

        const res = await apply({ website: "http://spam" });

        expect(res.status).toBe(200);
        expect(create).not.toHaveBeenCalled();
    });

    it("refuses when the verification fails", async () => {
        verifyTurnstile.mockResolvedValue(false);

        expect((await apply()).status).toBe(403);
        expect(create).not.toHaveBeenCalled();
    });

    it("limits how often one address and one email can apply", async () => {
        checkRateLimit.mockResolvedValue({ allowed: false });

        const res = await apply();

        expect(res.status).toBe(429);
        expect(create).not.toHaveBeenCalled();
        const identifiers = checkRateLimit.mock.calls.map((c) => c[0]);
        expect(identifiers).toEqual(expect.arrayContaining(["ip:203.0.113.9", "email:ada@example.com"]));
    });

    it("gives a fixed message when saving fails", async () => {
        vi.spyOn(console, "error").mockImplementation(() => {});
        create.mockRejectedValue(new Error("relation missing"));

        const res = await apply();
        const text = JSON.stringify(await res.json());

        expect(res.status).toBe(500);
        expect(text).not.toContain("relation missing");
    });
});
