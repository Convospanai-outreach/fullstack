// @vitest-environment jsdom
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import InstantConfirmationPanel from "./InstantConfirmationPanel";

const SEQUENCES = [
  { id: "seq-1", name: "Welcome", channel: "email" as const },
  { id: "seq-2", name: "Reminder", channel: "whatsapp" as const },
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
          onSave={vi.fn(async () => "Saved.")}
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
    expect(container.textContent).toContain("Welcome (Email)");
    expect(container.textContent).toContain("Reminder (WhatsApp)");
  });

  it("saves {enabled, sequenceId} with the chosen sequence", async () => {
    const onSave = vi.fn(async () => "Saved.");
    await render({ onSave });
    await turnOn();
    await choose("seq-2");
    await submit();
    expect(onSave).toHaveBeenCalledWith({ enabled: true, sequenceId: "seq-2" });
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

  it("loads the saved state from the page", async () => {
    await render({ initial: { enabled: true, sequenceId: "seq-2" } });
    await act(async () => {});
    expect(toggle().checked).toBe(true);
    expect(picker()!.value).toBe("seq-2");
  });
});
