// All V8 homepage copy lives here, as plain data, so it can later move into a CMS content file
// (apps/web/content/settings) without touching the components.

export const STORY_NAMES = ["Desire", "Problem", "Guide", "Plan", "Action", "Stakes", "Success"] as const;

export const CHANNELS = [
  { id: "insta", label: "Instagram" },
  { id: "facebook", label: "Facebook" },
  { id: "linkedin", label: "LinkedIn" },
  { id: "email", label: "Email" },
  { id: "whatsapp", label: "WhatsApp" },
  { id: "landing", label: "Landing pages" },
] as const;

export const PLAN_ITEMS = [
  { n: "01", title: "FIND", body: "Capture interest from social, search and forms." },
  { n: "02", title: "CONNECT", body: "Choose email, WhatsApp, LinkedIn or a call—where supported." },
  { n: "03", title: "ADVANCE", body: "Route replies to AI-assisted or human follow-up." },
] as const;

export const AUDIENCES = {
  solo: {
    label: "Just me / My brand",
    cards: [
      { tag: "CONSULTANTS", title: "Good advice deserves a second conversation.", body: "Bring enquiries into one place. Give every prospect a next move." },
      { tag: "CREATORS", title: "Likes get noticed. Leads get followed up.", body: "Move from social interest to a focused landing page and an actual enquiry." },
      { tag: "COACHES", title: "Your next booking could be buried in a DM.", body: "Capture interest, qualify enquiries and keep consultation requests moving." },
    ],
  },
  teams: {
    label: "My sales team",
    cards: [
      { tag: "CYBERSECURITY & MSSPs", title: "Risk changes. Buying decisions follow.", body: "Turn relevant signals into timely, reviewed outreach." },
      { tag: "MANAGED IT & CLOUD", title: "Every migration starts a conversation.", body: "Connect infrastructure changes with targeted outreach and follow-through." },
      { tag: "AI, DATA & ERP", title: "Big transformations start small.", body: "Spot interest, secure the meeting and keep the next step moving." },
    ],
  },
} as const;
export type AudienceKey = keyof typeof AUDIENCES;

export const JOURNEY = [
  { tag: "01 / ATTRACT", title: "Catch interest.", body: "Social, LinkedIn, email or campaigns." },
  { tag: "02 / CAPTURE", title: "Give it a destination.", body: "Landing pages and lead forms." },
  { tag: "03 / ENGAGE", title: "Make contact count.", body: "Supported WhatsApp, email, LinkedIn, AI voice or human calls." },
  { tag: "04 / ADVANCE", title: "Keep the next move clear.", body: "Qualified reply, meeting or follow-up task." },
] as const;

export const WORKFLOW = [
  { node: "Signals", meta: "STEP 1 / SIGNALS", short: "Capture every valid buying signal before it goes cold.", title: "Import or capture buyer signals",
    text: "Bring inbound interest, imports and supported lead sources into one governed queue before they disappear into tabs, inboxes or DMs.",
    bullets: ["Capture form fills, campaign leads and supported channel responses in one place.", "Group signals with source context so the next move starts informed.", "Stop relying on memory, screenshots and scattered spreadsheets."],
    badges: ["Lead intake", "Source context", "Queue control"],
    mini: [["LANDING PAGES", "New form enquiry logged"], ["LINKEDIN", "Prospect interaction captured"], ["WHATSAPP", "Conversation flagged for follow-up"]] },
  { node: "Drafts", meta: "STEP 2 / DRAFTS", short: "AI writes the first draft. Humans keep the final say.", title: "Prepare AI-assisted outreach drafts",
    text: "Turn raw interest into a usable first move. Draft messages faster, keep context intact and avoid starting from a blank page every time.",
    bullets: ["Generate first-pass outreach with the right account and source context.", "Keep tone, offer and next-step intent aligned to the funnel stage.", "Remove busywork without surrendering judgment."],
    badges: ["AI assist", "First drafts", "Message context"],
    mini: [["EMAIL", "Draft prepared for review"], ["LINKEDIN", "Connection note suggested"], ["WHATSAPP", "Follow-up reply drafted"]] },
  { node: "Channels", meta: "STEP 3 / CHANNELS", short: "One record. Multiple channels. Cleaner coordination.", title: "Connect supported channels and contact records",
    text: "Bring the contact, the channel and the context together. No more hopping between tabs to remember who said what and where.",
    bullets: ["Tie supported channels to the same opportunity record.", "See the conversation path across email, LinkedIn, WhatsApp and landing pages.", "Keep channel use aligned with supported integration rules and permissions."],
    badges: ["Unified records", "Channel map", "Context continuity"],
    mini: [["CONTACT RECORD", "Source and owner matched"], ["CHANNEL STATUS", "Email, social and voice view"], ["AI VOICE", "Call path available where enabled"]] },
  { node: "Tracking", meta: "STEP 4 / TRACKING", short: "If a reply lands, the team should know what it means.", title: "Track replies and channel status",
    text: "Watch responses, delivery states and follow-up timing from one governed view. A reply should trigger momentum, not confusion.",
    bullets: ["Surface replies, opens and channel states in a shared workflow.", "Identify stalled conversations before they disappear.", "Give each active opportunity a visible status and next signal."],
    badges: ["Reply tracking", "Status view", "Momentum alerts"],
    mini: [["REPLY STATUS", "Positive response detected"], ["CHANNEL VIEW", "Waiting, active or stalled"], ["TASK CUE", "Next follow-up suggested"]] },
  { node: "Review", meta: "STEP 5 / REVIEW", short: "Not every next move should go out unchecked.", title: "Review and approve appropriate next actions",
    text: "Put control where it matters. Review drafts, approve the right next move and keep the workflow governed instead of guess-driven.",
    bullets: ["Add human approvals before sensitive or high-value actions.", "Route uncertain cases to the right reviewer instead of auto-sending noise.", "Maintain oversight without slowing everything to a crawl."],
    badges: ["Human approval", "Governance", "Quality control"],
    mini: [["APPROVAL QUEUE", "Action pending review"], ["RISK CHECK", "Low / medium / high sensitivity"], ["NEXT MOVE", "Approve, edit or pause"]] },
  { node: "Advance", meta: "STEP 6 / ADVANCE", short: "The point is progress, not activity.", title: "Advance opportunities with human oversight",
    text: "Once the next move is approved, keep the opportunity advancing. The goal is a clearer conversation, a booked meeting or a live deal—not a busier dashboard.",
    bullets: ["Move the best opportunities toward meetings, proposals and next-step tasks.", "Keep people in the loop where human judgment wins business.", "Turn activity into a pipeline that actually moves."],
    badges: ["Meetings", "Proposals", "Human follow-through"],
    mini: [["QUALIFIED INTEREST", "Marked ready to progress"], ["MEETING", "Booked or requested"], ["PIPELINE", "Opportunity advanced"]] },
] as const;

export const SIGNUP_PATHS = {
  individual: { label: "Individual / Creator", hint: "Build your own lead-to-client journey.", cta: "Build my funnel ↗" },
  team: { label: "Business / Team", hint: "Explore a governed sales-team pilot.", cta: "Explore my pilot ↗" },
} as const;
export type SignupPath = keyof typeof SIGNUP_PATHS;
