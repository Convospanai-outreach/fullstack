import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const { mockJudge, mockMask } = vi.hoisted(() => ({ mockJudge: vi.fn(), mockMask: vi.fn() }));

vi.mock("@/lib/ai/jev", () => ({ judgeOutreachDraft: mockJudge, NOUL_NO: 0.3 }));
vi.mock("@/lib/ai/SovereignFirewall", () => ({ SovereignFirewall: { mask: mockMask } }));

import { jevScreenEnabled, screenDraft } from "../draftScreen";

const prospect = { title: "VP Sales", company: "Acme Corp", signal: "Series B announced" };
const draft = { subject: "Quick question", body: "Saw the Series B news. How are you thinking about ramping new reps?" };
const judged = (inventsFact: number, readsAsPitch: number, hardAsk: number) => mockJudge.mockResolvedValue({ inventsFact, readsAsPitch, hardAsk });

const saved = { ...process.env };
beforeEach(() => {
    vi.clearAllMocks();
    // The firewall hands back what it was given, as it does when only local masking applies.
    mockMask.mockImplementation(async (data: string) => ({ safeContext: data, tokenMap: new Map() }));
});
afterEach(() => {
    process.env = { ...saved };
});

describe("jevScreenEnabled", () => {
    it("is off unless JEV_SCREEN=on", () => {
        delete process.env["JEV_SCREEN"];
        expect(jevScreenEnabled()).toBe(false);
        process.env["JEV_SCREEN"] = "on";
        expect(jevScreenEnabled()).toBe(true);
    });
});

describe("screenDraft", () => {
    it("calls a draft clean only when every judgment is at or below the no threshold", async () => {
        judged(0.1, 0.2, 0.3);
        expect(await screenDraft(prospect, draft, "team")).toBe(true);
    });

    it("is not clean when any judgment is above the threshold, including the unsettled band", async () => {
        judged(0.31, 0.1, 0.1);
        expect(await screenDraft(prospect, draft, "team")).toBe(false);
        judged(0.1, 0.9, 0.1);
        expect(await screenDraft(prospect, draft, "team")).toBe(false);
        judged(0.1, 0.1, 0.5);
        expect(await screenDraft(prospect, draft, "team")).toBe(false);
    });

    it("is not clean when Jev cannot answer, and does not throw", async () => {
        mockJudge.mockRejectedValue(new Error("JEV_API_KEY is not set"));
        expect(await screenDraft(prospect, draft, "team")).toBe(false);
    });

    it("is not clean when the masked text cannot be read back", async () => {
        mockMask.mockResolvedValue({ safeContext: "not json", tokenMap: new Map() });
        expect(await screenDraft(prospect, draft, "team")).toBe(false);
        expect(mockJudge).not.toHaveBeenCalled();
    });

    it("does not ask Jev about a draft the code checks already reject", async () => {
        judged(0, 0, 0);
        expect(await screenDraft(prospect, { subject: "Hi", body: "Write to me at jane@example.com about it." }, "team")).toBe(false);
        expect(await screenDraft(prospect, { subject: "Hi", body: "Call +1 415 555 0134 today." }, "team")).toBe(false);
        expect(await screenDraft(prospect, { subject: "Hi", body: "We lifted revenue 87% for teams like yours." }, "team")).toBe(false);
        expect(mockJudge).not.toHaveBeenCalled();
    });

    it("sends the facts and the draft masked, as named state, and never an email address", async () => {
        judged(0, 0, 0);
        await screenDraft({ ...prospect, empty: "  " }, draft, "team");
        const sent = JSON.parse(mockMask.mock.calls[0][0]);
        expect(sent).toEqual({ prospect, draft });
        expect(mockMask.mock.calls[0][3]).toEqual({ alwaysMask: true });
        expect(mockJudge).toHaveBeenCalledWith({ prospect, draft }, "team");
    });
});
