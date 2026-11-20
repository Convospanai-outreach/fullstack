import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import DpaPage from "./dpa/page";
import SubprocessorsPage from "./subprocessors/page";
import Footer from "@/components/Footer";
import { PRIVACY_CONTACT_EMAIL } from "@/lib/trust";

const pages = { "/trust/dpa": () => renderToStaticMarkup(<DpaPage />), "/trust/subprocessors": () => renderToStaticMarkup(<SubprocessorsPage />) };

describe.each(Object.entries(pages))("%s", (_path, render) => {
    it("marks the legal text for lawyer review, and never claims compliance or certification", () => {
        const html = render();
        expect(html).toContain("[LAWYER REVIEW]");
        expect(html).not.toMatch(/DPDP[- ]compliant|certified|fully compliant|guarantee/i);
    });

    it("names the privacy contact", () => {
        expect(render()).toContain(PRIVACY_CONTACT_EMAIL);
    });
});

describe("the sub-processor list", () => {
    const html = pages["/trust/subprocessors"]();

    it("lists the services the code really calls", () => {
        for (const name of ["Oracle Cloud", "Render", "Supabase", "Upstash", "PostHog", "Sentry", "Resend", "OpenAI", "Anthropic", "Google Gemini", "TypeSafe"]) {
            expect(html).toContain(name);
        }
    });

    it("does not list services that were retired or are not confirmed in use", () => {
        for (const name of ["Vercel", "Railway", "Neon", "Groq", "DeepSeek"]) expect(html).not.toContain(name);
    });
});

describe("the footer", () => {
    it("links the trust pages and shows the privacy contact", () => {
        const html = renderToStaticMarkup(<Footer hideCTA />);
        expect(html).toContain('href="/trust/dpa"');
        expect(html).toContain('href="/trust/subprocessors"');
        expect(html).toContain(`mailto:${PRIVACY_CONTACT_EMAIL}`);
    });
});

describe("the trust pages are public", () => {
    it("are reachable without a session", () => {
        const proxy = readFileSync(resolve(__dirname, "../../proxy.ts"), "utf8");
        const providers = readFileSync(resolve(__dirname, "../providers.tsx"), "utf8");
        expect(proxy).toContain('"/trust"');
        expect(providers).toContain('"/trust"');
    });
});
