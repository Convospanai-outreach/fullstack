import { describe, expect, it, vi } from "vitest";
import { buildRewritePrompt, parseRewriteReply, rewriteDraft } from "./slopRewrite";
import { scoreSlop } from "./slopScore";

const sloppy = {
    subject: "Quick idea",
    body: "I hope this email finds you well! We cut churn by 23% at Acme — see https://acme.example/case. Worth a chat?",
};
const reply = (o: object) => JSON.stringify(o);

describe("buildRewritePrompt", () => {
    it("lists the tells found and forbids adding facts", () => {
        const prompt = buildRewritePrompt(sloppy, scoreSlop(sloppy).hits);
        expect(prompt).toContain("I hope this email finds you well");
        expect(prompt).toMatch(/do not add/i);
        expect(prompt).toContain(sloppy.body);
        expect(prompt).toContain('"subject"');
    });
});

describe("parseRewriteReply", () => {
    it("accepts a clean rewrite, even inside a code fence", () => {
        const out = parseRewriteReply("```json\n" + reply({ subject: "Churn at Acme", body: "We cut churn by 23% at Acme: https://acme.example/case. Worth a chat?" }) + "\n```", sloppy);
        expect(out.subject).toBe("Churn at Acme");
    });

    it("rejects a reply that is not JSON or has empty fields", () => {
        expect(() => parseRewriteReply("sure, here you go", sloppy)).toThrow(/JSON/);
        expect(() => parseRewriteReply(reply({ subject: "", body: "x" }), sloppy)).toThrow(/subject/);
        expect(() => parseRewriteReply(reply({ subject: "s", body: "  " }), sloppy)).toThrow(/body/);
    });

    it("rejects a rewrite that brings in a number or link the original did not have", () => {
        expect(() => parseRewriteReply(reply({ subject: "s", body: "We cut churn by 40% at Acme." }), sloppy)).toThrow(/40/);
        expect(() => parseRewriteReply(reply({ subject: "s", body: "See https://other.example now." }), sloppy)).toThrow(/other\.example/);
    });

    it("rejects a rewrite that is clearly longer than the original", () => {
        const long = Array.from({ length: 80 }, () => "word").join(" ");
        expect(() => parseRewriteReply(reply({ subject: "s", body: long }), sloppy)).toThrow(/longer/);
    });
});

describe("rewriteDraft", () => {
    it("makes no model call for a draft with no tells", async () => {
        const ask = vi.fn();
        const clean = { subject: "Onboarding drop-off", body: "Priya, your signup flow loses people at step three. Worth 15 minutes?" };
        const out = await rewriteDraft(clean, ask);
        expect(ask).not.toHaveBeenCalled();
        expect(out).toEqual({ draft: clean, rewritten: false });
    });

    it("sends the tells to the model and returns the validated rewrite", async () => {
        const ask = vi.fn().mockResolvedValue(reply({ subject: "Churn at Acme", body: "We cut churn by 23% at Acme: https://acme.example/case. Worth a chat?" }));
        const out = await rewriteDraft(sloppy, ask);
        expect(ask).toHaveBeenCalledOnce();
        expect(out.rewritten).toBe(true);
        expect(scoreSlop(out.draft).score).toBe(0);
    });

    it("fails instead of quietly keeping the original when the rewrite is invalid", async () => {
        const ask = vi.fn().mockResolvedValue(reply({ subject: "s", body: "We cut churn by 99%." }));
        await expect(rewriteDraft(sloppy, ask)).rejects.toThrow(/99/);
    });
});
