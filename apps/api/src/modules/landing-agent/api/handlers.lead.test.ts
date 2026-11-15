import { beforeEach, describe, expect, it, vi } from "vitest";

const { submitLeadBySlug } = vi.hoisted(() => ({
    submitLeadBySlug: vi.fn(async () => ({ lead: { id: "ll-1" } })),
}));

vi.mock("../service", () => ({ landingAgentService: { submitLeadBySlug } }));

import { postPublicLead } from "./handlers";

function post(body: unknown) {
    return new Request("https://api.example.test/landing-agent/public/guide/lead", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
    });
}

const ctx = { params: Promise.resolve({ slug: "guide" }) } as never;

describe("postPublicLead", () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it("drops a submission with the honeypot filled, silently, without saving", async () => {
        const res = await postPublicLead(post({ website: "http://spam.example", formFields: { email: "bot@example.com" } }), ctx);
        expect(res.status).toBe(202);
        expect(await res.json()).toMatchObject({ ok: true, discarded: true });
        expect(submitLeadBySlug).not.toHaveBeenCalled();
    });

    it("passes a lead form submission's formFields through to the service", async () => {
        const res = await postPublicLead(post({ formFields: { name: "Ada", email: "ada@example.com" } }), ctx);
        expect(res.status).toBe(200);
        expect(submitLeadBySlug).toHaveBeenCalledWith(
            expect.objectContaining({ slug: "guide", payload: expect.objectContaining({ formFields: { name: "Ada", email: "ada@example.com" } }) })
        );
    });

    it("passes the visitor's Meta _fbc and _fbp cookies to the service, dropping malformed values", async () => {
        const req = new Request("https://api.example.test/landing-agent/public/guide/lead", {
            method: "POST",
            headers: { "Content-Type": "application/json", Cookie: "theme=dark; _fbc=fb.1.1800000000000.IwAR-x_y; _fbp=fb.1.1800000000000.123; other=1" },
            body: JSON.stringify({ name: "Ada" }),
        });
        await postPublicLead(req, ctx);
        expect(submitLeadBySlug).toHaveBeenCalledWith(expect.objectContaining({ metaCookies: { fbc: "fb.1.1800000000000.IwAR-x_y", fbp: "fb.1.1800000000000.123" } }));

        const bad = new Request("https://api.example.test/landing-agent/public/guide/lead", {
            method: "POST",
            headers: { "Content-Type": "application/json", Cookie: "_fbc=%22%3Cscript%3E; _fbp=" },
            body: JSON.stringify({ name: "Ada" }),
        });
        await postPublicLead(bad, ctx);
        expect(submitLeadBySlug).toHaveBeenLastCalledWith(expect.objectContaining({ metaCookies: { fbc: undefined, fbp: undefined } }));
    });
});
