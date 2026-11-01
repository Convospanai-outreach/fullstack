// @vitest-environment jsdom
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import LeadFormSettingsPanel from "./LeadFormSettingsPanel";
import { LEAD_FORM_DEFAULT_CONFIG } from "./leadFormEditor";

const NOTE = "You are responsible for the consent wording, your privacy policy and handling deletion requests.";

describe("LeadFormSettingsPanel consent section", () => {
    let container: HTMLDivElement;
    let root: Root;

    beforeEach(() => {
        (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
        container = document.createElement("div");
        document.body.appendChild(container);
        root = createRoot(container);
    });

    afterEach(() => {
        act(() => root.unmount());
        container.remove();
    });

    it("shows the consent fields and the responsibility note", async () => {
        await act(async () => {
            root.render(<LeadFormSettingsPanel config={LEAD_FORM_DEFAULT_CONFIG} onApply={vi.fn()} />);
        });
        expect(container.textContent).toContain(NOTE);
        expect(container.textContent).toContain("Consent checkbox");
        expect(container.textContent).toContain("Privacy policy link");
        expect(container.textContent).toContain("Data deletion steps");
        const text = container.querySelector<HTMLTextAreaElement>('textarea[name="consentText"]');
        expect(text?.value).toBe("I agree to be contacted about my enquiry and to the privacy policy.");
    });

    it("applies a changed consent wording", async () => {
        const onApply = vi.fn();
        await act(async () => {
            root.render(<LeadFormSettingsPanel config={LEAD_FORM_DEFAULT_CONFIG} onApply={onApply} />);
        });
        const text = container.querySelector<HTMLTextAreaElement>('textarea[name="consentText"]')!;
        await act(async () => {
            text.value = "Send me tips.";
            text.dispatchEvent(new Event("change", { bubbles: true }));
            text.dispatchEvent(new Event("input", { bubbles: true }));
        });
        const applied = onApply.mock.calls.at(-1)?.[0];
        expect(applied?.consent?.text).toBe("Send me tips.");
    });
});
