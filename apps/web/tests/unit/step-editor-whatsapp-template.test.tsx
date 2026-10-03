// @vitest-environment jsdom
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import StepEditorDialog from "@/components/campaigns/sequence/StepEditorDialog";

(globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;

let root: Root;
let container: HTMLDivElement;

const step = { id: "s-1", stepType: "WHATSAPP", delayDays: 1, delayHours: 0, subject: null, body: null };

async function type(el: HTMLInputElement | HTMLTextAreaElement, value: string) {
    const proto = el instanceof HTMLTextAreaElement ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype;
    await act(async () => {
        Object.getOwnPropertyDescriptor(proto, "value")!.set!.call(el, value);
        el.dispatchEvent(new Event("input", { bubbles: true }));
    });
}
const saveButton = () => Array.from(document.querySelectorAll<HTMLButtonElement>("button")).find((b) => b.textContent === "Save step")!;

describe("StepEditorDialog WhatsApp template", () => {
    beforeEach(() => {
        container = document.createElement("div");
        document.body.appendChild(container);
        root = createRoot(container);
    });
    afterEach(async () => {
        await act(async () => root.unmount());
        container.remove();
        document.body.innerHTML = "";
    });

    it("saves the template name, language and values for a WhatsApp step", async () => {
        const onSave = vi.fn();
        await act(async () => root.render(<StepEditorDialog step={step} open onOpenChange={() => undefined} onSave={onSave} />));
        await type(document.querySelector<HTMLInputElement>("#wa-template")!, "guide_ready");
        await type(document.querySelector<HTMLTextAreaElement>("textarea")!, "{first_name}\nthe guide");
        expect(document.body.textContent).toContain("Template values (one per line)");
        await act(async () => saveButton().click());
        expect(onSave).toHaveBeenCalledWith(expect.objectContaining({
            whatsappTemplateName: "guide_ready",
            whatsappTemplateLanguage: "en_US",
            body: "{first_name}\nthe guide",
        }));
    });

    it("won't save a template name Meta wouldn't accept", async () => {
        const onSave = vi.fn();
        await act(async () => root.render(<StepEditorDialog step={step} open onOpenChange={() => undefined} onSave={onSave} />));
        await type(document.querySelector<HTMLInputElement>("#wa-template")!, "Guide Ready");
        expect(document.body.textContent).toContain("lowercase letters, numbers and underscores");
        expect(saveButton().disabled).toBe(true);
    });

    it("clears the template when left empty", async () => {
        const onSave = vi.fn();
        await act(async () => root.render(<StepEditorDialog step={{ ...step, whatsappTemplateName: "old", whatsappTemplateLanguage: "en_US" }} open onOpenChange={() => undefined} onSave={onSave} />));
        await type(document.querySelector<HTMLInputElement>("#wa-template")!, "");
        await act(async () => saveButton().click());
        expect(onSave).toHaveBeenCalledWith(expect.objectContaining({ whatsappTemplateName: null, whatsappTemplateLanguage: null }));
    });
});
