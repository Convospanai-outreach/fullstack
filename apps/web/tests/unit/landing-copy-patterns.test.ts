import { describe, expect, it } from "vitest";

import { applyCopyToComponent, COPY_GOALS, COPY_KINDS, COPY_PATTERNS, ctaCopyWarnings, patternsFor } from "@/components/landing-agent/copyPatterns";

describe("copy patterns", () => {
  it("has ten patterns for every goal, two of each kind", () => {
    expect(COPY_GOALS.map((g) => g.id)).toEqual(["get_leads", "book_calls", "sell_offer", "get_dms"]);
    for (const goal of COPY_GOALS) {
      const patterns = patternsFor(goal.id);
      expect(patterns).toHaveLength(10);
      for (const kind of COPY_KINDS) {
        expect(patterns.filter((p) => p.kind === kind)).toHaveLength(2);
      }
    }
  });

  it("covers the five kinds from the spec", () => {
    expect([...COPY_KINDS]).toEqual(["benefit_first", "specific_number", "curiosity_gap", "objection_handling", "urgency_true"]);
  });

  it("every pattern is free of honesty warnings, so the panel shows no warning for the curated set", () => {
    for (const goal of COPY_GOALS) {
      for (const pattern of patternsFor(goal.id)) {
        expect(ctaCopyWarnings(pattern.text), pattern.text).toEqual([]);
      }
    }
  });

  it("uses the [number] placeholder for numbers, never a real digit", () => {
    for (const goal of COPY_GOALS) {
      for (const pattern of patternsFor(goal.id)) {
        expect(pattern.text).not.toMatch(/\d/);
      }
    }
  });

  it("patterns for each goal are distinct", () => {
    for (const goal of COPY_GOALS) {
      const texts = patternsFor(goal.id).map((p) => p.text);
      expect(new Set(texts).size).toBe(texts.length);
    }
  });

  it("COPY_PATTERNS is keyed by every goal", () => {
    expect(Object.keys(COPY_PATTERNS).sort()).toEqual(COPY_GOALS.map((g) => g.id).sort());
  });
});

describe("ctaCopyWarnings", () => {
  const ids = (text: string) => ctaCopyWarnings(text).map((w) => w.id);

  it.each([
    ["Guaranteed results in a week", ["guarantee"]],
    ["Get a guarantee on it", ["guarantee"]],
    ["100% free, no catch", ["hundred_percent"]],
    ["Only 3 left!", ["only_n_left"]],
    ["only 12 seats left this month", ["only_n_left"]],
    ["Last chance to join", ["last_chance"]],
    ["Act now", ["act_now"]],
    ["500 people bought this", ["people_bought"]],
    ["[number] people joined this week", ["people_bought"]],
  ])("flags %j", (text, expected) => {
    expect(ids(text)).toEqual(expect.arrayContaining(expected));
    expect(ids(text)).toHaveLength(expected.length);
  });

  it.each([
    "Get the free guide",
    "Reserve my seat",
    "Book my free call",
    "Only use this if it is true",
    "Only 3 days of access",
    "Offer ends [date]",
    "Show me the checklist",
  ])("does not flag %j", (text) => {
    expect(ids(text)).toEqual([]);
  });

  it("returns a human message for each warning", () => {
    for (const warning of ctaCopyWarnings("Guaranteed! Act now")) {
      expect(warning.message.length).toBeGreaterThan(10);
    }
  });
});

describe("applyCopyToComponent", () => {
  function fakeComponent(type: string) {
    const calls: string[] = [];
    return {
      calls,
      is: (t: string) => t === type,
      components: (value: string) => {
        calls.push(value);
        return [];
      },
    };
  }

  it("writes the pattern into a selected text component", () => {
    const text = fakeComponent("text");
    expect(applyCopyToComponent(text, "Get the checklist")).toBe(true);
    expect(text.calls).toEqual(["Get the checklist"]);
  });

  it("does nothing for a non-text component or no selection", () => {
    const box = fakeComponent("default");
    expect(applyCopyToComponent(box, "Get the checklist")).toBe(false);
    expect(box.calls).toEqual([]);
    expect(applyCopyToComponent(undefined, "Get the checklist")).toBe(false);
    expect(applyCopyToComponent(null, "Get the checklist")).toBe(false);
  });
});
