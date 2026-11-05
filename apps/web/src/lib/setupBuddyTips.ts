// Copy and small pure helpers for the setup wizard's hourglass buddy.
// Keep tips to things the product really does; the repo is public.

export const BUDDY_NAME = "Tick";

export type BuddyMood = "idle" | "thinking" | "happy" | "cheer" | "concerned";

/** One or two short tips per wizard step id (ids match STEPS in app/setup/page.tsx). */
export const STEP_TIPS: Record<number, readonly string[]> = {
  1: [
    "Hi, I'm Tick. Pick who you're reaching out for and I'll hide the steps you don't need.",
    "Read the notice about your leads before you tick the box. It only takes a minute.",
  ],
  2: ["Your brand details show up in outreach and approvals, so it's worth getting them right once."],
  3: [
    "Connect the mailbox your messages will be sent from. Google, Microsoft, SMTP and Resend all work.",
    "Run the domain check after connecting. Better to find a DNS problem now than after your first send.",
  ],
  4: ["Email is the one to get working first. The other channels can wait."],
  5: ["A short voice guide keeps every draft sounding like you. A greeting and a signoff go a long way."],
  6: ["Add your AI provider key so drafts can be prepared. You still review before anything goes out."],
  7: ["Start small. A short, well-fitting lead list beats a huge one you have not looked at."],
  8: ["One campaign is enough to begin. Leads, copy and approvals all need somewhere to land."],
  9: ["Add a calendar link so a warm reply has a clear next step."],
  10: ["Check your credits before chargeable work starts, so nothing stalls halfway."],
  11: ["These handoffs are optional. Skip what you do not use."],
  12: ["Pick the alerts you actually want. Quiet inboxes are happy inboxes."],
  13: ["Invite teammates now and they can start the moment their invite lands."],
  14: ["Last check: test your domains so problems show up before your first send."],
};

export const CHEERS = [
  "Nice, that one's done.",
  "Another grain in the bottom bulb.",
  "Saved. Onwards.",
  "Smooth. Next one.",
] as const;

export const ERROR_LINES = [
  "That didn't go through. Have a look at the message and try again.",
  "Hmm, something's off. It happens. Check the message below and we'll retry.",
] as const;

export const SAVING_LINE = "Saving. Sand is falling...";
export const ALL_DONE_LINE = "Everything's ready. Time to let the sand run.";
export const HALFWAY_LINE = "Halfway there. The sand is really moving now.";

/** Fraction of sand in the lower bulb, 0..1, from a 0..100 completion percent. */
export function sandLevel(completionPercent: number): number {
  if (!Number.isFinite(completionPercent)) return 0;
  return Math.max(0, Math.min(1, completionPercent / 100));
}

/** A line to say when completion crosses a milestone, else null. */
export function milestoneLine(previous: number, next: number): string | null {
  if (next >= 100 && previous < 100) return ALL_DONE_LINE;
  if (next >= 50 && previous < 50) return HALFWAY_LINE;
  return null;
}

/** Deterministic pick so tests and re-renders are stable. */
export function pickLine<T>(lines: readonly T[], seed: number): T {
  return lines[Math.abs(Math.trunc(seed)) % lines.length]!;
}
