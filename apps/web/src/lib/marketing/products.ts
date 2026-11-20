// Product page copy. Claims are carried over from the previous product pages, trimmed and de-hyped.
// Unverified numbers and competitor comparisons were removed. Review the FAQ answers against the live product.
export type Product = {
  slug: string; name: string; short: string; metaTitle: string; metaDescription: string;
  eyebrow: string; title: string; lead: string;
  problem: { title: string; body: string };
  steps: { label: string; title: string; body: string }[];
  capabilities: { title: string; body: string }[];
  boundaries: string[];
  faq: { q: string; a: string }[];
};

export const PRODUCTS: Product[] = [
  {
    slug: "fluid-funnel-engine", name: "Fluid Funnel Engine", short: "The governed pipeline from signal to meeting.",
    metaTitle: "Fluid Funnel Engine: Governed B2B Outreach Pipeline | CraftMyFunnel",
    metaDescription: "One governed pipeline from signal to meeting: capture, AI drafting, human approval, sending, tracking and follow-up, so no lead falls through the cracks.",
    eyebrow: "Product · Fluid Funnel Engine", title: "One pipeline from first signal to booked meeting. No leaks.",
    lead: "The Fluid Funnel Engine runs every step between interest and a conversation: capture, draft, approve, send, track and follow up. Each step has an owner and a record.",
    problem: { title: "Interest is easy to get. Follow-through is where deals die.", body: "Leads arrive from forms, imports and social. Then they sit in inboxes, spreadsheets and DMs. Nobody owns the next move, and the buyer moves on." },
    steps: [
      { label: "Capture", title: "Import or capture leads", body: "Forms, CSV imports and supported sources land in one queue with source context." },
      { label: "Draft & approve", title: "AI drafts, a person approves", body: "Drafts wait in a review queue. Nothing is sent until someone signs off." },
      { label: "Advance", title: "Track, flag and move forward", body: "Replies and status are tracked. Stuck leads are flagged with their history." },
    ],
    capabilities: [
      { title: "Six-stage governed flow", body: "Capture, draft, sync context, track, review stuck leads, advance stage." },
      { title: "Batch approval queue", body: "Review, edit, approve or reject drafts in batches." },
      { title: "Stuck-lead surfacing", body: "Accounts with no engagement after your threshold (default 15 days) are flagged for review." },
      { title: "Deliverability guardrails", body: "Daily mailbox caps, bounce circuit breakers and one-click unsubscribe headers." },
      { title: "Team roles", body: "Owner, Admin, Member and Viewer roles with shared visibility and audit trails." },
      { title: "Works with your CRM", body: "Complements HubSpot or Salesforce. It runs the active workflow; your CRM keeps the record." },
    ],
    boundaries: ["Does not replace your CRM.", "Does not send without approval.", "Channel availability depends on your workspace's live integrations."],
    faq: [
      { q: "Does the Fluid Funnel Engine replace a CRM?", a: "No. It governs active outreach, approvals and sending, and complements CRMs such as HubSpot or Salesforce." },
      { q: "Which channels are supported?", a: "Google Workspace/Gmail and authenticated SMTP/IMAP mailboxes are live. LinkedIn, WhatsApp and calling depend on the integrations enabled for your workspace." },
      { q: "What happens when a lead gets stuck?", a: "After a configurable threshold (default 15 days) with no engagement, the lead is flagged for team review with its previous touchpoints and a suggested follow-up angle." },
      { q: "Can several people work the same funnel?", a: "Yes. Workspaces have role-based permissions, shared visibility and audit trails." },
      { q: "Is there a pilot?", a: "Yes. A 30-day guided pilot covers signal setup, qualification rules, template approval and pipeline review." },
    ],
  },
  {
    slug: "buyer-signals", name: "Buyer Signals", short: "Know who is expanding, hiring or tendering this week.",
    metaTitle: "Buyer Signals by NetJana: B2B Intent Signals for Service Teams | CraftMyFunnel",
    metaDescription: "NetJana watches hiring surges, expansions, tenders and procurement changes so your team reaches active buyers before the RFP drops.",
    eyebrow: "Product · Buyer Signals by NetJana", title: "Reach buyers the week they have a need. Not the week they chose a vendor.",
    lead: "NetJana watches public sources for signs a company is about to buy services: hiring surges, new sites, tenders, leadership changes. Matched accounts are ranked against your ICP every morning.",
    problem: { title: "Static contact lists tell you who. Not when.", body: "A database row doesn't know a company just signed a lease or posted 14 operations roles. Timing is what turns a cold email into a relevant one." },
    steps: [
      { label: "Define", title: "Set your ICP and signal types", body: "Headcount, geography, sector and the signal categories that matter to your service." },
      { label: "Rank", title: "Signals are validated and scored daily", body: "Shortlists refresh overnight so the team starts each day with current priorities." },
      { label: "Act", title: "A review-ready draft is prepared", body: "Accounts that meet your threshold get context and a draft in the approval queue." },
    ],
    capabilities: [
      { title: "Hiring expansion", body: "Bursts of operations, facilities or IT roles that signal growing service needs." },
      { title: "New sites & branches", body: "Office openings and fit-outs, where public records are available." },
      { title: "Tender activity", body: "Public and commercial procurement notices from monitored portals." },
      { title: "Facility expansion", body: "Lease and expansion announcements ahead of move-in." },
      { title: "Procurement changes", body: "New procurement leaders reviewing vendor rosters in their first 90 days." },
      { title: "Technology adoption", body: "ERP, CRM or security rollouts visible in job requirements." },
    ],
    boundaries: ["Coverage varies by city and country.", "Every account should be validated by your team before outreach.", "Not a standalone data subscription; export via CSV or API is available."],
    faq: [
      { q: "What sources does NetJana use?", a: "Public sources such as company job pages, procurement and tender portals, permit registries where available, and leadership announcements." },
      { q: "How often is data refreshed?", a: "Scoring runs daily. Shortlists and context update overnight." },
      { q: "Do I need a CRM?", a: "No. Accounts land in your CraftMyFunnel workspace, with optional HubSpot sync or CSV export." },
      { q: "Can we set filters for our industry?", a: "Yes. Configure your ICP by headcount, geography, sector and signal categories." },
      { q: "How is accuracy checked?", a: "Signals are validated against primary sources before scoring. Your team should still review accounts before outreach." },
    ],
  },
  {
    slug: "ai-outreach", name: "AI Outreach", short: "AI writes the draft. Your team clears it.",
    metaTitle: "AI Outreach with Human Approval | CraftMyFunnel",
    metaDescription: "CMF Core drafts personalised outreach with multiple AI models, routes every message through human approval and keeps one activity timeline.",
    eyebrow: "Product · AI Outreach (CMF Core)", title: "AI writes the draft. Your team clears it. Then, and only then, it goes out.",
    lead: "CMF Core drafts outreach grounded in your own case studies and the account's context, then puts every message in front of a person before it sends.",
    problem: { title: "Autopilot outreach is fast. It's also how brands get burned.", body: "Fully automated sequences send hallucinated claims and off-tone messages at scale. Manual writing doesn't scale at all. You need speed with a brake." },
    steps: [
      { label: "Ground", title: "Pull context", body: "Account signals plus matching case studies from your knowledge base." },
      { label: "Draft", title: "Generate a specific draft", body: "Multi-provider AI writes a first version for the stage and offer." },
      { label: "Approve & send", title: "Human review, then governed sending", body: "Approve, edit or reject. Approved messages send from your connected mailbox." },
    ],
    capabilities: [
      { title: "Mandatory approval", body: "No message sends without explicit operator review." },
      { title: "Grounded drafting (RAG)", body: "Drafts reference your real case studies that match the prospect's industry and size." },
      { title: "Provider-agnostic AI", body: "Routes across OpenAI, Anthropic and Google models with fallback." },
      { title: "Sender protection", body: "Daily caps, bounce circuit breakers and RFC 8058 one-click unsubscribe." },
      { title: "Learns from rejections", body: "Reviewer feedback is logged to avoid similar phrasing next time." },
      { title: "Google Workspace OAuth", body: "Connects with granular scopes under the Google API Services User Data Policy." },
    ],
    boundaries: ["Never sends autonomously.", "AI generation uses credits on draft creation; send credits settle only on approved, sent messages."],
    faq: [
      { q: "Can it send without approval?", a: "No. Every message requires explicit operator review." },
      { q: "Which AI models does it use?", a: "Models from OpenAI, Anthropic and Google through a provider-agnostic router with automatic fallback." },
      { q: "Can managers approve in batches?", a: "Yes. Approve verified drafts together or flag individual ones for edits." },
      { q: "What happens to a rejected draft?", a: "Reviewers can adjust the context or edit it manually. Feedback is logged to improve future drafts." },
      { q: "Are credits used for rejected drafts?", a: "Drafting uses a small amount of generation credit. Send credits are only used when an approved email is sent." },
    ],
  },
  {
    slug: "human-layer", name: "Human Layer", short: "Context-rich calling for deals email can't close.",
    metaTitle: "Human Layer: Caller Tasks & Follow-up | CraftMyFunnel",
    metaDescription: "Give your callers the full outreach history, suggested openers and one-click stage updates, so nothing falls through between an email and a signed contract.",
    eyebrow: "Product · Human Layer", title: "Not every B2B deal closes over email. Here's what happens next.",
    lead: "The Human Layer gives your callers a queue of warm accounts with the full timeline, a suggested opener and one-click stage updates, every action logged.",
    problem: { title: "The reply came in. Then nine days of silence.", body: "Warm replies wait because nobody knows who should call, or what was already said. By the time someone dials, the buyer has moved on." },
    steps: [
      { label: "Queue", title: "Warm accounts land with context", body: "Signals, emails, opens and replies on one card." },
      { label: "Call", title: "Call from your own phone or browser tool", body: "Suggested openers based on what the prospect actually said." },
      { label: "Govern", title: "Update the stage in one click", body: "Meeting-ready, follow-up or archive, attributed and timestamped." },
    ],
    capabilities: [
      { title: "Caller queue", body: "Prioritised tasks with the full outreach history." },
      { title: "One timeline", body: "Every email, open, reply and buyer signal side by side." },
      { title: "Stage controls", body: "Advance, schedule or archive with an audit trail." },
      { title: "Back to email", body: "Flag a lead for email and a follow-up draft is prepared from the caller's notes." },
      { title: "Audit log", body: "Every stage change records who and when." },
      { title: "Fits your phone setup", body: "Works alongside your desk phone or VoIP tool." },
    ],
    boundaries: ["Not a dialer or telephony system.", "Call recording and transcription are not included today."],
    faq: [
      { q: "Is this a predictive dialer?", a: "No. It organises who to call, what to say and how the stage changes. Use your existing phone or VoIP tool." },
      { q: "Can callers update stages during a call?", a: "Yes, with a single click, and every change is logged." },
      { q: "What if the caller wants an email follow-up?", a: "The lead returns to AI Outreach with the caller's notes, and a follow-up draft appears in the approval queue." },
      { q: "Which plans include it?", a: "Basic caller tasks are on all plans. Multi-caller queue routing is on Growth and Enterprise." },
    ],
  },
  {
    slug: "covospan-edge", name: "Covospan EDGE", short: "Optional on-premise node for data sovereignty.",
    metaTitle: "Covospan EDGE: Sovereign Edge Node | CraftMyFunnel",
    metaDescription: "An optional on-premise node that tokenises personal data, runs AI checks and keeps audit logs on hardware you own, before anything reaches the cloud.",
    eyebrow: "Product · Covospan EDGE", title: "Your client data stays where it belongs. With you.",
    lead: "Covospan EDGE is an optional appliance on your network. It masks personal data before prompts reach cloud AI, and keeps audit logs on hardware you physically own.",
    problem: { title: "Some clients won't let their data touch a shared cloud.", body: "Security, defence-adjacent and regulated buyers ask where prospect data goes. 'A US cloud model' is often the wrong answer." },
    steps: [
      { label: "Tokenise", title: "Personal data is replaced on-site", body: "Names, emails and identifiers become surrogate tokens before leaving your network." },
      { label: "Process", title: "Cloud AI sees only tokens", body: "The model writes grammar and flow without learning real identities." },
      { label: "Log", title: "Audit stays local", body: "Signed logs you can stream to your SIEM or export for audits." },
    ],
    capabilities: [
      { title: "Local PII tokenisation", body: "HMAC-based blind indexing before cloud handoff." },
      { title: "Offline buffering", body: "If the connection drops, logs are buffered encrypted and sends pause safely." },
      { title: "Air-gapped option", body: "Local masking and drafting without internet for high-security environments." },
      { title: "Signed updates", body: "Verified over-the-air updates your IT team can review." },
      { title: "SIEM-ready logs", body: "Stream to Splunk or Datadog, or export signed JSON/CSV." },
      { title: "Simple install", body: "Power and an Ethernet connection to your LAN or DMZ." },
    ],
    boundaries: ["Optional. CraftMyFunnel runs fully in the cloud without it.", "Enterprise package with custom deployment support."],
    faq: [
      { q: "Is EDGE required?", a: "No. It's an optional enterprise extension for teams with on-premise or sovereignty requirements." },
      { q: "What happens if the internet drops?", a: "Logs are buffered in encrypted storage and outbound cloud sends pause until the connection is back." },
      { q: "Can it run air-gapped?", a: "Yes, for local masking and local draft generation." },
      { q: "Who maintains the hardware?", a: "Devices ship pre-configured. Updates are signed and can be reviewed by your IT team." },
      { q: "Can audit logs be exported?", a: "Yes, to your SIEM or as signed JSON/CSV bundles." },
    ],
  },
];
export const productBySlug = (slug: string) => PRODUCTS.find((p) => p.slug === slug)!;
