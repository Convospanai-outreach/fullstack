import { afterEach, describe, expect, it, vi } from "vitest";
import { createPiiMasker, maskForLLM, piiMaskingEnabled, PiiMaskingError } from "./piiMask";

const AADHAAR = "2345 6789 0123";
const AADHAAR_PLAIN = "234567890123";
const PAN = "ABCDE1234F";
const PHONE = "+91 98765 43210";
const EMAIL = "asha.rao@acme.example";

function roundTrip(text: string, names?: string[]) {
    const m = createPiiMasker(names ? { names } : {});
    const masked = m.mask(text);
    return { masked, restored: m.restore(masked) };
}

describe("createPiiMasker - what gets masked in the outbound text", () => {
    it("masks an email address", () => {
        const { masked } = roundTrip(`Write to ${EMAIL} today`);
        expect(masked).not.toContain(EMAIL);
        expect(masked).not.toContain("asha.rao");
    });

    it("masks an Aadhaar number, spaced, hyphenated and plain", () => {
        for (const value of [AADHAAR, "2345-6789-0123", AADHAAR_PLAIN]) {
            expect(roundTrip(`ID ${value} end`).masked).not.toMatch(/2345|6789|0123|234567890123/);
        }
    });

    it("masks a PAN, in either case", () => {
        expect(roundTrip(`PAN ${PAN}`).masked).not.toContain(PAN);
        expect(roundTrip(`PAN ${PAN.toLowerCase()}`).masked).not.toContain(PAN.toLowerCase());
    });

    it("masks +91, 91, 0-prefixed and bare 10-digit Indian mobile numbers, with or without a gap", () => {
        for (const value of ["+91 98765 43210", "+919876543210", "91-9876543210", "09876543210", "9876543210", "98765 43210"]) {
            expect(roundTrip(`Call ${value} now`).masked).not.toMatch(/98765|43210|9876543210/);
        }
    });

    it("masks a person's name given by the caller, and each part of it, in any case", () => {
        const { masked } = roundTrip("Hi Asha Rao, this is for ASHA. Mr rao will follow up.", ["Asha Rao"]);
        expect(masked).not.toMatch(/asha/i);
        expect(masked).not.toMatch(/\brao\b/i);
    });

    it("masks the value of a labelled name field even when the caller gave no names", () => {
        const { masked } = roundTrip('fullName: Meera Iyer\nfirstName: "Meera"\nCompany: Acme');
        expect(masked).not.toMatch(/Meera|Iyer/);
        expect(masked).toContain("Acme");
    });

    it("leaves text with no personal data exactly as it was", () => {
        const text = "Write a short cold email about our CRM for a 50 person logistics company. Order 4411 ships in 3 days.";
        expect(roundTrip(text).masked).toBe(text);
    });

    it("does not read a 10-digit number inside a longer number as a phone", () => {
        const text = "Invoice 1234598765432100 total";
        expect(roundTrip(text).masked).toBe(text);
    });
});

describe("createPiiMasker - restoring the model's output", () => {
    it("puts every original value back, so the draft reads as if nothing was masked", () => {
        const text = `Dear Asha Rao, reach ${EMAIL} or ${PHONE}. PAN ${PAN}, Aadhaar ${AADHAAR}.`;
        const { restored } = roundTrip(text, ["Asha Rao"]);
        expect(restored).toBe(text);
    });

    it("gives the same value the same token, and restores it wherever the model repeats it", () => {
        const m = createPiiMasker({});
        const masked = m.mask(`${EMAIL} and again ${EMAIL}`);
        const token = masked.split(" and again ")[0]!;
        expect(masked).toBe(`${token} and again ${token}`);
        expect(m.restore(`Hello ${token}, bye ${token}`)).toBe(`Hello ${EMAIL}, bye ${EMAIL}`);
    });

    it("restores in a draft that was written from the masked prompt (model output)", () => {
        const m = createPiiMasker({ names: ["Asha Rao"] });
        const masked = m.mask("To: Asha Rao <asha.rao@acme.example>");
        const draft = `{"subject":"Hello","body":"${masked}"}`;
        expect(m.restore(draft)).toContain("asha.rao@acme.example");
        expect(m.restore(draft)).toContain("Asha Rao");
    });

    it("refuses model output that still holds one of this request's placeholders after restoring", () => {
        const m = createPiiMasker({});
        const token = m.mask(EMAIL);
        const forged = token.replace(/_[0-9a-f]+>$/, "_9999>");
        expect(() => m.restore(`see ${forged}`)).not.toThrow(); // another request's token shape is just text
        const m2 = createPiiMasker({});
        const t2 = m2.mask(EMAIL);
        // A placeholder the model altered so it no longer matches the map, but still carries this request's marker.
        const mangled = t2.replace(/>/g, " >");
        expect(() => m2.restore(`see ${mangled}`)).toThrow(PiiMaskingError);
    });

    it("keeps the token map out of every string it hands back, including errors", () => {
        const m = createPiiMasker({});
        m.mask(EMAIL);
        let message = "";
        try { m.restore("x <EMAIL_1 >"); } catch (e) { message = (e as Error).message; }
        expect(message).not.toContain("asha.rao");
    });
});

describe("maskForLLM - the wrapper the model call goes through", () => {
    const original = process.env["LLM_PII_MASKING"];
    afterEach(() => {
        if (original === undefined) delete process.env["LLM_PII_MASKING"]; else process.env["LLM_PII_MASKING"] = original;
    });

    it("is off unless LLM_PII_MASKING is exactly 'on', and then changes nothing", () => {
        delete process.env["LLM_PII_MASKING"];
        expect(piiMaskingEnabled()).toBe(false);
        process.env["LLM_PII_MASKING"] = "true";
        expect(piiMaskingEnabled()).toBe(false);
        const out = maskForLLM({ prompt: `mail ${EMAIL}`, systemPrompt: "sys" });
        expect(out.prompt).toBe(`mail ${EMAIL}`);
        expect(out.systemPrompt).toBe("sys");
        expect(out.restore("same")).toBe("same");
    });

    it("when on, masks the prompt and the system prompt with one shared set of tokens", () => {
        process.env["LLM_PII_MASKING"] = "on";
        const out = maskForLLM({ prompt: `mail ${EMAIL}`, systemPrompt: `never write to ${EMAIL}` }, ["Asha"]);
        expect(out.prompt).not.toContain(EMAIL);
        expect(out.systemPrompt).not.toContain(EMAIL);
        const token = out.prompt.replace("mail ", "");
        expect(out.systemPrompt).toBe(`never write to ${token}`);
        expect(out.restore(`ok ${token}`)).toBe(`ok ${EMAIL}`);
    });

    it("fails closed: when masking throws, it throws a PiiMaskingError instead of returning the raw text", () => {
        process.env["LLM_PII_MASKING"] = "on";
        expect(() => maskForLLM({ prompt: 12345 as unknown as string })).toThrow(PiiMaskingError);
        expect(() => maskForLLM({ prompt: "x", systemPrompt: {} as unknown as string })).toThrow(PiiMaskingError);
    });

    it("the error says what happened and carries none of the text", () => {
        process.env["LLM_PII_MASKING"] = "on";
        const bad = vi.fn();
        try { maskForLLM({ prompt: 12345 as unknown as string }); } catch (e) { bad((e as Error).message); }
        expect(bad.mock.calls[0]![0]).toMatch(/not sent/i);
        expect(bad.mock.calls[0]![0]).not.toContain("12345");
    });
});

describe("createPiiMasker - names that are not plain ASCII", () => {
    it.each([
        ["Élodie Martin", "Hello Élodie Martin, thanks for the call."],
        ["李雷", "Please follow up with 李雷 tomorrow."],
        ["José", "Reply to José about pricing."],
    ])("masks %s when the caller supplies it", (name, text) => {
        const masker = createPiiMasker({ names: [name] });
        const out = masker.mask(text);

        expect(out).not.toContain(name);
        expect(masker.restore(out)).toBe(text);
    });

    it("does not mask a name that is only part of a longer word", () => {
        const masker = createPiiMasker({ names: ["Ann"] });

        expect(masker.mask("Annual plan, Annabel")).toBe("Annual plan, Annabel");
    });
});

describe("createPiiMasker - labelled name fields", () => {
    it.each(["Name: Meera Iyer", "name = Meera Iyer", "Prospect: Meera Iyer", "Prospect Name: Meera Iyer"])("masks the value after %s", (line) => {
        const masker = createPiiMasker();
        const out = masker.mask(`${line}\nShe asked about pricing. Meera said yes.`);

        expect(out).not.toContain("Meera");
        expect(out).not.toContain("Iyer");
    });
});
