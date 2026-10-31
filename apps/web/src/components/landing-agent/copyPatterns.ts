// Static, curated headline and CTA patterns for the editor's "Pick a stronger headline/CTA" panel.
// No AI call: every pattern is a fixed string. Numbers are written as [number] and dates as [date];
// the user fills in the real value, so nothing is invented for them. Pure data and checks only.

export const COPY_KINDS = ["benefit_first", "specific_number", "curiosity_gap", "objection_handling", "urgency_true"] as const;
export type CopyKind = (typeof COPY_KINDS)[number];

export const COPY_GOALS = [
  { id: "get_leads", label: "Get sign-ups" },
  { id: "book_calls", label: "Book calls" },
  { id: "sell_offer", label: "Sell an offer" },
  { id: "get_dms", label: "Get DMs" },
] as const;
export type CopyGoal = (typeof COPY_GOALS)[number]["id"];

export interface CopyPattern {
  kind: CopyKind;
  text: string;
}

// Two per kind, per goal. Urgency patterns need the user to type a real date or number.
export const COPY_PATTERNS: Record<CopyGoal, readonly CopyPattern[]> = {
  get_leads: [
    { kind: "benefit_first", text: "Get the checklist for planning your next launch" },
    { kind: "benefit_first", text: "Get [number] practical steps you can start today" },
    { kind: "specific_number", text: "Get the [number]-point checklist" },
    { kind: "specific_number", text: "Read [number] questions to ask before you buy" },
    { kind: "curiosity_gap", text: "The one step people often skip before launching" },
    { kind: "curiosity_gap", text: "See what usually goes wrong in the third week" },
    { kind: "objection_handling", text: "Not ready to buy? Start with the free guide" },
    { kind: "objection_handling", text: "Short enough to read on your phone tonight" },
    { kind: "urgency_true", text: "Doors close [date]. Join before then" },
    { kind: "urgency_true", text: "The next free workshop is on [date]" },
  ],
  book_calls: [
    { kind: "benefit_first", text: "Book a call and leave with a clear next step" },
    { kind: "benefit_first", text: "Book a call to plan your next [number] months" },
    { kind: "specific_number", text: "Book a [number]-minute call. No slides" },
    { kind: "specific_number", text: "Choose one of [number] open times this week" },
    { kind: "curiosity_gap", text: "Find out why your last campaign stalled" },
    { kind: "curiosity_gap", text: "Two questions decide if this makes sense for you" },
    { kind: "objection_handling", text: "Not sure it is for you? Ask on the call and decide then" },
    { kind: "objection_handling", text: "No pitch deck. We start with your situation" },
    { kind: "urgency_true", text: "Calendar closes [date] for this month" },
    { kind: "urgency_true", text: "We take [number] new calls each month. Book this one" },
  ],
  sell_offer: [
    { kind: "benefit_first", text: "Get the offer built for your next step" },
    { kind: "benefit_first", text: "Get [number] bonuses when you join this week" },
    { kind: "specific_number", text: "Start with the [number]-day plan" },
    { kind: "specific_number", text: "Save [number] steps with the ready-made setup" },
    { kind: "curiosity_gap", text: "The question most buyers ask first" },
    { kind: "curiosity_gap", text: "What we changed after our first customers" },
    { kind: "objection_handling", text: "Not sure it fits? Read the details before you decide" },
    { kind: "objection_handling", text: "See exactly what is included before you pay" },
    { kind: "urgency_true", text: "Price changes on [date]. Decide before then" },
    { kind: "urgency_true", text: "This offer closes on [date]" },
  ],
  get_dms: [
    { kind: "benefit_first", text: "DM me the word GUIDE and I will send it" },
    { kind: "benefit_first", text: "Comment GUIDE and get the checklist in your DMs" },
    { kind: "specific_number", text: "Reply with [number] words about your goal and I will tailor it" },
    { kind: "specific_number", text: "Send me a DM with your [number]-step question" },
    { kind: "curiosity_gap", text: "The question people ask me most often" },
    { kind: "curiosity_gap", text: "Want the step-by-step version? Send me a DM" },
    { kind: "objection_handling", text: "Not sure yet? Get the free version first" },
    { kind: "objection_handling", text: "No sales call. Just the guide" },
    { kind: "urgency_true", text: "I will send it until [date]" },
    { kind: "urgency_true", text: "Comment before [date] to get it" },
  ],
};

export function patternsFor(goal: CopyGoal): readonly CopyPattern[] {
  return COPY_PATTERNS[goal];
}

export type CopyWarningId = "guarantee" | "hundred_percent" | "only_n_left" | "last_chance" | "act_now" | "people_bought";

export interface CopyWarning {
  id: CopyWarningId;
  message: string;
}

// Phrases that make a headline or CTA claim something the page may not be able to back up.
// The helper shows these as warnings. It blocks nothing: the user decides, and the rules
// (no fake countdowns, no invented scarcity or social proof) are the user's to keep.
const RISKY_PHRASES: readonly { id: CopyWarningId; pattern: RegExp; message: string }[] = [
  { id: "guarantee", pattern: /\bguarantee[ds]?\b/i, message: "'Guarantee' is a promise. Only use it if you can honour it in writing." },
  { id: "hundred_percent", pattern: /\b100\s*%/, message: "'100%' is an absolute claim. Only use it if you can prove it." },
  {
    id: "only_n_left",
    pattern: /\bonly\s+\d+\s+(left|remaining|spots?|seats?|places?)\b/i,
    message: "'Only N left' is a scarcity claim. Only use it if you typed the real number yourself.",
  },
  { id: "last_chance", pattern: /\blast chance\b/i, message: "'Last chance' implies a deadline. Only use it if the offer really ends." },
  { id: "act_now", pattern: /\bact now\b/i, message: "'Act now' is pressure without a reason. Say what happens and when." },
  {
    id: "people_bought",
    pattern: /(\d[\d,]*|\[number\])\+?\s+people\s+(have\s+)?(bought|joined|signed\s+up|downloaded|enrolled|trust)/i,
    message: "A count of people is social proof. Only use it if the number is real and you typed it.",
  },
];

export function ctaCopyWarnings(text: string): CopyWarning[] {
  return RISKY_PHRASES.filter((rule) => rule.pattern.test(text)).map((rule) => ({ id: rule.id, message: rule.message }));
}
