// Honest positioning only: what each tool is built for, and when to pick it. No claims about competitors'
// internals, security or data handling. Check competitor descriptions against their sites before each launch.
export type Comparison = {
  slug: string; name: string; summary: string;
  theyAre: string; pickThem: string[]; pickUs: string[];
  rows: [string, string, string][]; // [topic, CraftMyFunnel, them]
};

const COMMON_US = [
  "Every AI draft must be approved by a person before it sends.",
  "You sell a considered B2B service and need fewer, more relevant conversations.",
  "You want buyer signals, outreach, approvals and caller follow-up in one workflow.",
  "You sell in India and need consent-aware WhatsApp and DPDP-ready handling alongside email.",
];

export const COMPARISONS: Comparison[] = [
  {
    slug: "apollo", name: "Apollo.io",
    summary: "Apollo is a contact database with sequencing. CraftMyFunnel is a governed workflow for service firms that need timing, review and follow-through.",
    theyAre: "A large B2B contact and company database with built-in multi-step email sequencing and a dialer.",
    pickThem: ["You need a large searchable contact database.", "You run high-volume, multi-step sequences today.", "Your team prefers one tool for data plus sequencing."],
    pickUs: COMMON_US,
    rows: [
      ["Core idea", "Signal-led, approved outreach and follow-up", "Contact data plus sequences"],
      ["Human approval before send", "Required for every AI draft", "Optional; depends on your setup"],
      ["Buyer timing signals", "Hiring, expansion, tender and procurement signals (NetJana)", "Intent and job-change data"],
      ["Caller follow-up", "Context-rich caller queue (Human Layer)", "Built-in dialer"],
      ["Multi-step sequences", "Timed steps across email and WhatsApp, each reviewed", "Mature, high-volume sequence builder"],
      ["India: WhatsApp + DPDP", "Consent-aware WhatsApp where configured", "Not a focus"],
    ],
  },
  {
    slug: "instantly", name: "Instantly",
    summary: "Instantly is built for cold email at volume. CraftMyFunnel is built for fewer, reviewed messages to accounts with a reason to talk now.",
    theyAre: "A cold email platform focused on sending volume across many inboxes, with warm-up and inbox rotation.",
    pickThem: ["Your model depends on high email volume.", "You manage many sending inboxes and want warm-up built in.", "You don't need a review step per message."],
    pickUs: COMMON_US,
    rows: [
      ["Core idea", "Quality and governance", "Volume and inbox scale"],
      ["Human approval before send", "Required for every AI draft", "Not the default workflow"],
      ["Sender protection", "Daily caps, bounce circuit breakers, one-click unsubscribe", "Warm-up and inbox rotation"],
      ["Buyer timing signals", "Built in (NetJana)", "Lead data add-ons"],
      ["Caller follow-up", "Built in (Human Layer)", "Not a focus"],
    ],
  },
  {
    slug: "lemlist", name: "Lemlist",
    summary: "Lemlist is a multichannel sequence tool. CraftMyFunnel adds buyer timing, a mandatory review step and caller follow-up for service sales.",
    theyAre: "A multichannel prospecting tool with email and LinkedIn sequences, personalisation features and its own warm-up.",
    pickThem: ["You want a mature email + LinkedIn sequence builder now.", "You rely on image or video personalisation.", "Your team is comfortable with automated sends."],
    pickUs: COMMON_US,
    rows: [
      ["Core idea", "Governed workflow for service sales", "Multichannel sequences"],
      ["Human approval before send", "Required for every AI draft", "Optional"],
      ["Industry playbooks", "Built for MSSPs, MSPs, SAP partners, GCC services, staffing", "General templates"],
      ["Buyer timing signals", "Built in (NetJana)", "Lead database add-on"],
      ["Caller follow-up", "Built in (Human Layer)", "Calls via integrations"],
    ],
  },
];
export const comparisonBySlug = (slug: string) => COMPARISONS.find((c) => c.slug === slug)!;
