// @vitest-environment jsdom
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import InstantConfirmationPanel from "./InstantConfirmationPanel";

const SEQUENCES = [
  { id: "seq-1", name: "Welcome", channel: "email" as const, status: "ACTIVE" as const, campaignId: "camp-1" },
  { id: "seq-2", name: "Reminder", channel: "whatsapp" as const, status: "DRAFT" as const, campaignId: null },
];

describe("InstantConfirmationPanel", () => {
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

  const toggle = () => container.querySelector<HTMLInputElement>("#instant-confirmation-enabled")!;
  const picker = () => container.querySelector<HTMLSelectElement>("#instant-confirmation-sequence");
  const saveButton = () => container.querySelector<HTMLButtonElement>("button[type=submit]")!;

  async function render(props: Partial<React.ComponentProps<typeof InstantConfirmationPanel>> = {}) {
    await act(async () => {
      root.render(
        <InstantConfirmationPanel
          onLoadSequences={vi.fn(async () => SEQUENCES)}
          onSave={vi.fn(async () => ({ message: "Saved." }))}
          {...props}
        />
      );
    });
  }

  async function turnOn() {
    await act(async () => toggle().click());
  }

  async function choose(value: string) {
    const el = picker()!;
    const setter = Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype, "value")!.set!;
    await act(async () => {
      setter.call(el, value);
      el.dispatchEvent(new Event("change", { bubbles: true }));
    });
  }

  async function submit() {
    await act(async () => {
      container.querySelector("form")!.dispatchEvent(new Event("submit", { bubbles: true, cancelable: true }));
    });
  }

  it("is off by default and shows no picker", async () => {
    await render();
    expect(toggle().checked).toBe(false);
    expect(picker()).toBeNull();
    expect(container.textContent).toContain(
      "Sent once right after someone submits the form. Not sent if they decline the consent box, are on your do-not-contact list, or already receive another automatic sequence. If you pick a draft sequence it starts on the first sign-up."
    );
    expect(container.querySelector<HTMLAnchorElement>("a[href='/campaigns']")).not.toBeNull();
  });

  it("lists only the sequences the server returned", async () => {
    await render({ onLoadSequences: vi.fn(async () => SEQUENCES) });
    await turnOn();
    const values = [...picker()!.options].map((option) => option.value).filter(Boolean);
    expect(values).toEqual(["seq-1", "seq-2"]);
    expect(container.textContent).toContain("Welcome (Email, Active)");
    expect(container.textContent).toContain("Reminder (WhatsApp, Draft)");
  });

  it("links the chosen sequence to its campaign's Sequence tab, and only when it has a campaign", async () => {
    await render();
    await turnOn();
    await choose("seq-1");
    expect(container.querySelector<HTMLAnchorElement>("a[href='/campaigns/camp-1?tab=sequence']")).not.toBeNull();
    await choose("seq-2");
    expect(container.querySelector("a[href*='?tab=sequence']")).toBeNull();
  });

  it("saves {enabled, sequenceId} with the chosen sequence", async () => {
    const onSave = vi.fn(async () => ({ message: "Saved." }));
    await render({ onSave });
    await turnOn();
    await choose("seq-2");
    await submit();
    expect(onSave).toHaveBeenCalledWith({ enabled: true, sequenceId: "seq-2" });
  });

  it("shows the copy warnings the save returned, as plain text", async () => {
    const onSave = vi.fn(async () => ({
      message: "Saved.",
      warnings: ["This message sounds like a promise or a sales pitch. A confirmation works best as a plain thank-you."],
    }));
    await render({ onSave });
    await turnOn();
    await choose("seq-1");
    await submit();
    expect(container.textContent).toContain("This message sounds like a promise or a sales pitch.");
    expect(container.querySelector("b, script")).toBeNull();
  });

  it("shows no warning when the save returned none", async () => {
    await render({ onSave: vi.fn(async () => ({ message: "Saved.", warnings: [] })) });
    await turnOn();
    await choose("seq-1");
    await submit();
    expect(container.textContent).toContain("Saved.");
    expect(container.textContent).not.toContain("sales pitch");
  });

  it("shows the API error inline when the save is refused", async () => {
    const onSave = vi.fn(async () => {
      throw new Error("Only a draft or active sequence can be used.");
    });
    await render({ onSave });
    await turnOn();
    await choose("seq-1");
    await submit();
    expect(container.textContent).toContain("Only a draft or active sequence can be used.");
  });

  it("shows an empty state, and keeps save off, when the team has no eligible sequence", async () => {
    await render({ onLoadSequences: vi.fn(async () => []) });
    await turnOn();
    expect(picker()).toBeNull();
    expect(container.textContent).toContain("no sequence");
    expect(container.textContent).toContain("exactly one active step");
    expect(container.textContent).toContain("sender mailbox");
    expect(container.textContent).toContain("approved WhatsApp template");
    expect(saveButton().disabled).toBe(true);
  });

  it("says so when the saved sequence no longer qualifies, and keeps save off until a new one is picked", async () => {
    await render({ initial: { enabled: true, sequenceId: "seq-gone" } });
    await act(async () => {});
    expect(container.textContent).toContain("The sequence you picked no longer qualifies");
    expect(picker()!.value).toBe("");
    expect(saveButton().disabled).toBe(true);
    await choose("seq-1");
    expect(container.textContent).not.toContain("no longer qualifies");
    expect(saveButton().disabled).toBe(false);
  });

  it("does not blame the saved sequence when the list could not load", async () => {
    await render({ initial: { enabled: true, sequenceId: "seq-1" }, onLoadSequences: vi.fn(async () => Promise.reject(new Error("down"))) });
    await act(async () => {});
    expect(container.textContent).not.toContain("no longer qualifies");
  });

  it("loads the saved state from the page", async () => {
    await render({ initial: { enabled: true, sequenceId: "seq-2" } });
    await act(async () => {});
    expect(toggle().checked).toBe(true);
    expect(picker()!.value).toBe("seq-2");
  });
});
