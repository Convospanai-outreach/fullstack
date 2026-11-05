// Default copy for the V8 homepage. The words an editor can change live in
// apps/web/content/settings/home.json (edited in the CMS under "Home page"); each field there falls back to
// the value here when it is empty or missing, so a half-finished edit can never blank the page.
// Layout, ids and order stay in code because the scroll anchors depend on them.
import { mergeText } from "@/lib/siteContent";
import homeJson from "../../../../content/settings/home.json";

export const STORY_NAMES = ["Desire", "Problem", "Guide", "Plan", "Action", "Stakes", "Success"] as const;

export const CHANNELS = [
  { id: "insta", label: "Instagram" },
  { id: "facebook", label: "Facebook" },
  { id: "linkedin", label: "LinkedIn" },
  { id: "email", label: "Email" },
  { id: "whatsapp", label: "WhatsApp" },
  { id: "landing", label: "Landing pages" },
] as const;

type Block = { kicker: string; title: string; accent: string; body: string };
type Card = { tag: string; title: string; body: string };
type Story = { eyebrow: string; title: string; accent: string; body: string; punch: string; note: string; primary: string; secondary: string };
type Step = {
  node: string; meta: string; short: string; title: string; text: string;
  bullets: string[]; badges: string[]; mini: { label: string; text: string }[];
};
type SignupPathText = { label: string; hint: string; cta: string };

export type HomeText = {
  story: Story[];
  plan: { n: string; title: string; body: string }[];
  closing: { eyebrow: string; title: string; accent: string; bridge: string; bridgeBold: string };
  audiences: { intro: Block; solo: { label: string; cards: Card[] }; teams: { label: string; cards: Card[] } };
  channels: { intro: Block; journey: Card[]; note: string };
  crm: { intro: Block; cards: Card[] };
  workflow: { kicker: string; heading: string; intro: string; steps: Step[] };
  signup: { eyebrow: string; title: string; accent: string; body: string; phase: string; formEyebrow: string; formTitle: string; formIntro: string; individual: SignupPathText; team: SignupPathText };
};

export const HOME_DEFAULTS: HomeText = {
  story: [
    { eyebrow: "01 / THE OPENING", title: "Someone is ready to buy.", accent: "Are you in the picture?", body: "A scroll. A search. A referral. Your next customer is already somewhere in the crowd.", punch: "Make the shortlist. Not the sidelines.", note: "Scroll to activate the engine", primary: "Build my funnel ↗", secondary: "Follow the signal ↓" },
    { eyebrow: "02 / THE BREAK", title: "The lead came in.", accent: "Then went missing.", body: "An Instagram DM here. A LinkedIn reply there. A form filled. A WhatsApp unread.", punch: "Plenty of interest. Precious little follow-through.", note: "The problem isn’t traffic. It’s the handoff.", primary: "", secondary: "" },
    { eyebrow: "03 / THE GUIDE", title: "A hundred touchpoints.", accent: "One firm grip.", body: "Bring social, forms, email and outreach into one organised journey. Let AI assist. Keep people in charge.", punch: "Connected channels. Clear ownership. No lead left to guesswork.", note: "Automation with brakes, not blinders.", primary: "", secondary: "" },
    { eyebrow: "04 / THE PLAN", title: "Catch the signal.", accent: "Keep the momentum.", body: "Three moves. One moving pipeline.", punch: "No channel should be a dead end.", note: "", primary: "", secondary: "" },
    { eyebrow: "05 / THE DECISION", title: "Your audience showed interest.", accent: "Make your move.", body: "One campaign. One landing page. One clear next step.", punch: "Turn the click into a conversation.", note: "Start with the people you actually want to reach.", primary: "Start my funnel ↗", secondary: "" },
    { eyebrow: "06 / WHAT SLIPS AWAY", title: "An unread message", accent: "doesn’t send a warning.", body: "The DM cools. The form goes stale. The buyer finds someone faster.", punch: "Silence isn’t a sales strategy.", note: "", primary: "", secondary: "" },
    { eyebrow: "07 / WHAT MOVES FORWARD", title: "From “seen”", accent: "to “let’s talk.”", body: "A captured enquiry. A relevant reply. A meeting with a name and a next step.", punch: "Less chasing ghosts. More genuine conversations.", note: "", primary: "", secondary: "" },
  ],
  plan: [
    { n: "01", title: "FIND", body: "Capture interest from social, search and forms." },
    { n: "02", title: "CONNECT", body: "Choose email, WhatsApp, LinkedIn or a call—where supported." },
    { n: "03", title: "ADVANCE", body: "Route replies to AI-assisted or human follow-up." },
  ],
  closing: { eyebrow: "THE TURNING POINT", title: "Same attention.", accent: "Different ending.", bridge: "Interest has a short shelf life.", bridgeBold: "Give it somewhere to go." },
  audiences: {
    intro: { kicker: "BEYOND THE FIRST CLICK / THE ADDENDUM", title: "Different hustles.", accent: "Same missed chances.", body: "From a one-person practice to a sales floor, a better follow-up changes the story." },
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
  },
  channels: {
    intro: { kicker: "ONE JOURNEY / MANY ENTRY POINTS", title: "A click is a beginning.", accent: "Not a business result.", body: "Put your channels to work together. From first interest to a clear next step." },
    journey: [
      { tag: "01 / ATTRACT", title: "Catch interest.", body: "Social, LinkedIn, email or campaigns." },
      { tag: "02 / CAPTURE", title: "Give it a destination.", body: "Landing pages and lead forms." },
      { tag: "03 / ENGAGE", title: "Make contact count.", body: "Supported WhatsApp, email, LinkedIn or human calls." },
      { tag: "04 / ADVANCE", title: "Keep the next move clear.", body: "Qualified reply, meeting or follow-up task." },
    ],
    note: "Channels shown are the intended product journey. Availability, permissions, calling consent and supported automation depend on the live integration and account configuration.",
  },
  crm: {
    intro: { kicker: "FOR TEAMS WITH A CRM", title: "Your CRM records the past.", accent: "Who owns the next move?", body: "Keep the system of record. Make follow-through the system of action." },
    cards: [
      { tag: "YOUR CRM", title: "What happened.", body: "Contacts, activities, deal history and pipeline stages." },
      { tag: "CRAFTMYFUNNEL", title: "What happens next.", body: "Relevant signals, coordinated outreach, approvals and follow-up." },
    ],
  },
  workflow: {
    kicker: "THE CORE / GOVERNED WORKFLOW",
    heading: "Six steps. No loose ends.",
    intro: "Every signal gets a route. Every move gets a reason. Inspect the workflow that turns scattered attention into a governed next step.",
    steps: [
      { node: "Signals", meta: "STEP 1 / SIGNALS", short: "Capture every valid buying signal before it goes cold.", title: "Import or capture buyer signals",
        text: "Bring inbound interest, imports and supported lead sources into one governed queue before they disappear into tabs, inboxes or DMs.",
        bullets: ["Capture form fills, campaign leads and supported channel responses in one place.", "Group signals with source context so the next move starts informed.", "Stop relying on memory, screenshots and scattered spreadsheets."],
        badges: ["Lead intake", "Source context", "Queue control"],
        mini: [{ label: "LANDING PAGES", text: "New form enquiry logged" }, { label: "LINKEDIN", text: "Prospect interaction captured" }, { label: "WHATSAPP", text: "Conversation flagged for follow-up" }] },
      { node: "Drafts", meta: "STEP 2 / DRAFTS", short: "AI drafts. You review before outreach goes out.", title: "Prepare AI-assisted outreach drafts",
        text: "Turn raw interest into a usable first move. Draft messages faster, keep context intact and avoid starting from a blank page every time.",
        bullets: ["Generate first-pass outreach with the right account and source context.", "Keep tone, offer and next-step intent aligned to the funnel stage.", "Remove busywork without surrendering judgment."],
        badges: ["AI assist", "First drafts", "Message context"],
        mini: [{ label: "EMAIL", text: "Draft prepared for review" }, { label: "LINKEDIN", text: "Connection note suggested" }, { label: "WHATSAPP", text: "Follow-up reply drafted" }] },
      { node: "Channels", meta: "STEP 3 / CHANNELS", short: "One record. Multiple channels. Cleaner coordination.", title: "Connect supported channels and contact records",
        text: "Bring the contact, the channel and the context together. No more hopping between tabs to remember who said what and where.",
        bullets: ["Tie supported channels to the same opportunity record.", "See the conversation path across email, LinkedIn, WhatsApp and landing pages.", "Keep channel use aligned with supported integration rules and permissions."],
        badges: ["Unified records", "Channel map", "Context continuity"],
        mini: [{ label: "CONTACT RECORD", text: "Source and owner matched" }, { label: "CHANNEL STATUS", text: "Email, social and call view" }, { label: "CALL HANDOFF", text: "Leads queued for your team to call" }] },
      { node: "Tracking", meta: "STEP 4 / TRACKING", short: "If a reply lands, the team should know what it means.", title: "Track replies and channel status",
        text: "Watch responses, delivery states and follow-up timing from one governed view. A reply should trigger momentum, not confusion.",
        bullets: ["Surface replies, opens and channel states in a shared workflow.", "Identify stalled conversations before they disappear.", "Give each active opportunity a visible status and next signal."],
        badges: ["Reply tracking", "Status view", "Momentum alerts"],
        mini: [{ label: "REPLY STATUS", text: "Positive response detected" }, { label: "CHANNEL VIEW", text: "Waiting, active or stalled" }, { label: "TASK CUE", text: "Next follow-up suggested" }] },
      { node: "Review", meta: "STEP 5 / REVIEW", short: "Not every next move should go out unchecked.", title: "Review and approve appropriate next actions",
        text: "Put control where it matters. Review drafts, approve the right next move and keep the workflow governed instead of guess-driven.",
        bullets: ["Review recipients and messages before outreach.", "Hold uncertain drafts back for a person to check.", "Maintain oversight without slowing everything to a crawl."],
        badges: ["Review step", "Governance", "Quality control"],
        mini: [{ label: "APPROVAL QUEUE", text: "Action pending review" }, { label: "RISK CHECK", text: "Low / medium / high sensitivity" }, { label: "NEXT MOVE", text: "Approve, edit or pause" }] },
      { node: "Advance", meta: "STEP 6 / ADVANCE", short: "The point is progress, not activity.", title: "Advance opportunities with human oversight",
        text: "Once the next move is approved, keep the opportunity advancing. The goal is a clearer conversation, a booked meeting or a live deal—not a busier dashboard.",
        bullets: ["Move the best opportunities toward meetings, proposals and next-step tasks.", "Keep people in the loop where human judgment wins business.", "Turn activity into a pipeline that actually moves."],
        badges: ["Meetings", "Proposals", "Human follow-through"],
        mini: [{ label: "QUALIFIED INTEREST", text: "Marked ready to progress" }, { label: "MEETING", text: "Booked or requested" }, { label: "PIPELINE", text: "Opportunity advanced" }] },
    ],
  },
  signup: {
    eyebrow: "CRAFTMYFUNNEL / GET STARTED",
    title: "The next enquiry",
    accent: "is your move.",
    body: "Social, landing pages, outreach, follow-up and calls—one clear path from first signal to next action.",
    phase: "CAPTURE · CONNECT · CONVERT",
    formEyebrow: "YOUR NEXT MOVE STARTS HERE",
    formTitle: "One good lead deserves a next move.",
    formIntro: "Choose your path. Then get started.",
    individual: { label: "Individual / Creator", hint: "Build your own lead-to-client journey.", cta: "Build my funnel ↗" },
    team: { label: "Business / Team", hint: "Explore a governed sales-team pilot.", cta: "Explore my pilot ↗" },
  },
};

/** The page copy: CMS words laid over the defaults, field by field. */
export const HOME: HomeText = mergeText(HOME_DEFAULTS, homeJson);

export type AudienceKey = "solo" | "teams";
export type SignupPath = "individual" | "team";
