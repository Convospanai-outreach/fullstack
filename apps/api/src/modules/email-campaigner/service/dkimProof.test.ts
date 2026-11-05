import { describe, expect, it, vi } from "vitest";

vi.mock("@/lib/db", () => ({ prisma: {} }));
vi.mock("./smtpConfigService", () => ({ sendViaSmtpMailbox: vi.fn() }));

import { dkimProofConfigFromEnv, parseDkimVerdict } from "./dkimProof";

describe("parseDkimVerdict", () => {
    it("reads a passing, aligned signature with SPF and DMARC", () => {
        const header = "mx.example.net; dkim=pass header.d=example.com header.s=google; spf=pass smtp.mailfrom=example.com; dmarc=pass header.from=example.com";
        expect(parseDkimVerdict([header], "example.com")).toEqual({ dkim: "pass", signingDomain: "example.com", aligned: true, spf: "pass", dmarc: "pass" });
    });

    it("counts a signature from a parent domain as aligned, and one from another domain as not", () => {
        expect(parseDkimVerdict(["mx; dkim=pass header.d=example.com"], "mail.example.com").aligned).toBe(true);
        const other = parseDkimVerdict(["mx; dkim=pass header.d=esp.net"], "example.com");
        expect(other).toMatchObject({ dkim: "pass", signingDomain: "esp.net", aligned: false });
    });

    it("keeps the aligned pass when a later hop shows a failure", () => {
        const verdict = parseDkimVerdict(["a; dkim=pass header.d=example.com", "b; dkim=fail header.d=example.com"], "example.com");
        expect(verdict.dkim).toBe("pass");
    });

    it("reports a failure, and none when the receiver wrote no DKIM result", () => {
        expect(parseDkimVerdict(["mx; dkim=fail header.d=example.com"], "example.com").dkim).toBe("fail");
        expect(parseDkimVerdict(["mx; spf=pass"], "example.com")).toMatchObject({ dkim: "none", spf: "pass" });
        expect(parseDkimVerdict([], "example.com").dkim).toBe("none");
    });

    it("does not read spf=pass inside a dkim clause as a dkim result", () => {
        expect(parseDkimVerdict(["mx; spf=pass smtp.mailfrom=example.com"], "example.com").dkim).toBe("none");
    });
});

describe("dkimProofConfigFromEnv", () => {
    const env = { DKIM_PROOF_ADDRESS: "proof@x.test", DKIM_PROOF_IMAP_HOST: "imap.x.test", DKIM_PROOF_IMAP_USER: "proof@x.test", DKIM_PROOF_IMAP_PASSWORD: "pw" };

    it("is null until all four settings are present", () => {
        expect(dkimProofConfigFromEnv({})).toBeNull();
        expect(dkimProofConfigFromEnv({ ...env, DKIM_PROOF_IMAP_PASSWORD: "" })).toBeNull();
    });

    it("defaults the port to 993", () => {
        expect(dkimProofConfigFromEnv(env)?.port).toBe(993);
        expect(dkimProofConfigFromEnv({ ...env, DKIM_PROOF_IMAP_PORT: "143" })?.port).toBe(143);
    });
});
