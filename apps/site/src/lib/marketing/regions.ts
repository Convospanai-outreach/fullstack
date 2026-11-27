import type { Market } from "./industries";

// Market pages. Guidance text is a prompt for the customer's own legal review, not legal advice.
export type Region = { slug: string; name: string; market: Market; law: string; title: string; lead: string; channels: string; scenarios: string[]; guidance: string; pricing: string };

export const REGIONS: Region[] = [
  {
    slug: "india",
    law: "DPDP",
    name: "India",
    market: "india",
    title: "Built for how India buys: WhatsApp, email, a phone call and a person who follows up.",
    lead: "For service firms selling to GCCs, enterprises and mid-market companies across India's main business corridors. Signals, reviewed outreach and caller follow-up in one place.",
    channels: "Email first, LinkedIn for senior buyers, WhatsApp only with consent, and a human call for warm replies.",
    scenarios: ["An IFM provider following up on new GCC sites in Hyderabad and Pune.", "A staffing firm acting on a hiring surge at a Bengaluru capability centre.", "A privacy consultancy running DPDP readiness outreach to mid-size fintechs."],
    guidance: "The DPDP Act and Rules apply to personal data processed in India, with full compliance due by 13 May 2027. Capture and record consent before WhatsApp outreach, give a clear notice and opt-out, and honour erasure requests. TRAI rules apply to commercial calls and SMS.",
    pricing: "INR plans with Razorpay checkout.",
  },
  {
    slug: "united-states",
    law: "US state privacy laws",
    name: "United States",
    market: "us-eu",
    title: "Governed outbound for US service firms. Every send reviewed, every reply owned.",
    lead: "For MSSPs, MSPs and ERP partners selling into the US mid-market. AI-drafted, human-approved email and LinkedIn outreach, with stuck deals surfaced before they go cold.",
    channels: "Email and LinkedIn first. Calls handled by your team with full context.",
    scenarios: ["An MSSP running a focused campaign to regional banks and credit unions.", "An MSP following up on a cloud-migration offer while delivery runs.", "An SAP partner working an ECC-readiness list before the 2027 deadline."],
    guidance: "CAN-SPAM requires accurate sender identity, a physical postal address and a working opt-out honoured within 10 business days. TCPA rules apply to calls and texts. Some states (e.g. California) add privacy obligations. Review these before you send.",
    pricing: "Public prices shown in USD.",
  },
  {
    slug: "europe",
    law: "GDPR and UK GDPR",
    name: "Europe & UK",
    market: "us-eu",
    title: "Outreach that respects GDPR, for European technical service teams.",
    lead: "Organise researched accounts, prepare reviewed drafts and track follow-up for cybersecurity, managed IT and cloud, and SAP/ERP services, with an approval step before anything goes out.",
    channels: "Email and LinkedIn, sent only after a person approves.",
    scenarios: ["A security consultancy offering NIS2 gap assessments in one country.", "An MSP coordinating follow-up while delivery work continues.", "A data consultancy carrying account context into a project conversation."],
    guidance: "Electronic marketing rules vary by recipient country. Review local rules, the purpose of the message, recipient eligibility and transparency information before sending. The UK is not an EU Member State and needs its own assessment.",
    pricing: "Public prices shown in USD.",
  },
  {
    slug: "uae",
    law: "UAE PDPL",
    name: "UAE",
    market: "global",
    title: "A focused workflow for UAE technical service teams.",
    lead: "Keep researched account context, outreach drafts and follow-up visible for UAE cybersecurity, cloud and ERP service opportunities.",
    channels: "Email and LinkedIn, with WhatsApp where consent exists.",
    scenarios: ["A managed-security provider organising research for one service.", "A cloud consultancy preparing a review-ready migration message.", "An ERP partner keeping a handoff visible after a first meeting."],
    guidance: "Assess UAE federal requirements and, where relevant, the separate DIFC or ADGM position before sending. Publicly listed business contact details are not blanket permission for marketing outreach.",
    pricing: "Public prices shown in USD.",
  },
  {
    slug: "canada",
    law: "PIPEDA",
    name: "Canada",
    market: "global",
    title: "A focused workflow for Canadian technical service teams.",
    lead: "Prepare account-specific outreach and track next steps for cybersecurity, managed IT and cloud, and SAP/ERP services.",
    channels: "Email and LinkedIn, sent after review.",
    scenarios: ["A cloud services team reviewing a small account set for one managed offer.", "A cybersecurity consultancy preparing account context before outreach.", "A data implementation firm tracking ownership after discovery."],
    guidance: "Complete a CASL assessment before sending commercial electronic messages. Conspicuous publication is conditional, not automatic permission: assess relevance to the recipient's role, any contrary notice, identification, unsubscribe handling and retained evidence.",
    pricing: "Public prices shown in USD.",
  },
];
export const regionBySlug = (slug: string) => REGIONS.find((r) => r.slug === slug);
