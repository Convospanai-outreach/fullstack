// Industries CraftMyFunnel targets first, grouped by market. "Why now" facts are dated, sourced market
// drivers about the BUYER's market (not claims about CraftMyFunnel). Re-check them before reusing in ads.
export type Market = "us-eu" | "india" | "global";
export const MARKET_LABEL: Record<Market, string> = { "us-eu": "US · EU", india: "India", global: "Global" };

export type Industry = {
  slug: string;
  name: string;
  market: Market;
  title: string;
  lead: string;
  whyNow: { title: string; stats: { value: string; text: string }[]; source: string };
  buyer: string;
  challenge: string;
  situations: [string, string][];
  example: string[];
  pilot: string;
  limits: string;
  notFit: string;
  faq: { q: string; a: string }[];
  /** Not a compliance-deadline niche: kept off the home page, region pages and the deadline groups on /industries. */
  more?: true;
};

export const INDUSTRIES: Industry[] = [
  {
    slug: "cybersecurity",
    name: "Cybersecurity & MSSPs",
    market: "us-eu",
    title: "Security budgets are now mandatory. Be the provider who follows up first.",
    lead: "NIS2 and DORA moved security from discretionary to required spend. Prepare researched accounts, review every outreach draft and keep the next step owned for security consulting and managed security deals.",
    whyNow: {
      title: "Regulation is creating buyers who have never bought managed security before.",
      stats: [
        { value: "160,000+", text: "European entities now covered by NIS2, with fines up to €10M or 2% of global turnover." },
        { value: "299,000", text: "security professionals short in Europe, pushing firms toward managed and co-managed services." },
        { value: "12.3%", text: "forecast annual growth in the managed security services market, 2026–2031." },
      ],
      source: "Source: Mordor Intelligence, Europe Cybersecurity and Managed Security Services market reports, 2026.",
    },
    buyer: "Founders, commercial leaders and sales heads at cybersecurity consultancies, MSSPs and MDR providers.",
    challenge: "Technical credibility gets you into a conversation. Scattered account notes and unclear follow-up ownership leave the next conversation waiting while a competitor answers the compliance question first.",
    situations: [
      ["Account context is scattered", "Keep researched leads and their conversation history in one shared workflow."],
      ["Technical messages need careful review", "AI prepares the draft; a person checks it before anything is sent."],
      ["A proposal has no clear next step", "Track lead status and see the next follow-up on the activity timeline."],
    ],
    example: ["Pick one service, e.g. a NIS2 gap assessment, and one researched account group.", "Prepare a message about the account's stated business context.", "Review recipients, message and sender setup before outreach begins.", "Review replies and record the next step with your commercial team."],
    pilot: "One security service, one country and a small group of researched business accounts.",
    limits: "CraftMyFunnel does not perform security assessments, find a prospect's vulnerabilities or decide whether a company is in NIS2 scope.",
    notFit: "Teams looking for security assessment delivery, vulnerability detection or a fully automated outbound service.",
    faq: [
      { q: "Does this find security vulnerabilities?", a: "No. It organises account context and commercial follow-up. It does not assess a prospect's security posture." },
      { q: "Can it tell me which companies fall under NIS2?", a: "No. Scope depends on sector, size and member-state rules. Use your own research and qualification." },
    ],
  },
  {
    slug: "managed-it-cloud",
    name: "Managed IT & cloud (MSPs)",
    market: "us-eu",
    title: "Your delivery team is busy. Your pipeline shouldn't go quiet.",
    lead: "Small and mid-sized firms now face reporting duties that used to apply only to banks. Bring MSP and cloud prospecting into one workflow with researched leads, reviewed drafts and tracked follow-up.",
    whyNow: {
      title: "Mid-market firms are inheriting enterprise-grade obligations without enterprise-grade teams.",
      stats: [
        { value: "18", text: "sectors now in NIS2 scope, including food, waste management and postal services." },
        { value: "24 hrs", text: "to file an initial incident notice under NIS2 and DORA, with a detailed report at 72 hours." },
        { value: "71.9%", text: "of managed security services were delivered cloud-based in 2025." },
      ],
      source: "Sources: NIS2 Directive (EU) 2022/2555; Mordor Intelligence, Managed Security Services market report, 2026.",
    },
    buyer: "Owners, growth directors and commercial heads at MSPs, cloud consultancies and IT service firms.",
    challenge: "Delivery work comes first. When prospect context lives in individual inboxes, the team spends its time rebuilding what happened and who should follow up.",
    situations: [
      ["Delivery and sales share a small team", "Prepare the account list and drafts before the campaign starts."],
      ["Several people touch the same account", "See lead history and campaign activity in one place."],
      ["A retainer conversation goes quiet", "Stuck leads are flagged with their history so an owner can act."],
    ],
    example: ["Choose one managed service or cloud migration offer.", "Import a researched account list and check its relevance.", "Review the messages and connect a sender mailbox.", "Track replies and hand relevant conversations to your team."],
    pilot: "One managed service or cloud offer, one geography and a small researched account group.",
    limits: "CraftMyFunnel does not know a prospect's contract renewal date or detect migration intent unless your team supplies that context.",
    notFit: "Teams wanting contract-renewal detection, migration-intent data or a fully managed sales service.",
    faq: [
      { q: "Can it identify companies about to migrate to the cloud?", a: "No. Use your own research and account context to decide which companies to approach." },
      { q: "Can it replace a sales owner?", a: "No. A team member stays responsible for recipient checks, message review and next steps." },
    ],
  },
  {
    slug: "sap-erp",
    name: "SAP & ERP partners",
    market: "global",
    title: "The SAP ECC deadline is a buying window. Most of it is still open.",
    lead: "Thousands of ECC customers still have to choose a path before mainstream maintenance ends. Prepare service-specific outreach, review it and keep consultative follow-up moving for migration, AMS and data projects.",
    whyNow: {
      title: "A hard deadline, a long project and a large undecided base.",
      stats: [
        { value: "31 Dec 2027", text: "SAP mainstream maintenance ends for ECC 6.0 on enhancement packages 6–8." },
        { value: "61%", text: "of roughly 35,000 ECC customers had not licensed S/4HANA at the end of 2024 (Gartner)." },
        { value: "18–36 mo", text: "typical length of a full S/4HANA migration project." },
      ],
      source: "Sources: SAP maintenance policy; Gartner via Redress Compliance; Panorama Consulting, 2026.",
    },
    buyer: "Founders, partners and growth leaders at SAP partners, ERP implementers and data/AI consultancies.",
    challenge: "A long capability list makes a weak first message. A project conversation needs one business problem, one relevant service and continuity when a partner hands it to a colleague.",
    situations: [
      ["The first message lists too many services", "Build a campaign around one service, e.g. ECC readiness assessments, and one buyer group."],
      ["Partner-led conversations need a handoff", "Lead context and activity stay visible to the whole team."],
      ["Each project has a different buying journey", "Review drafts and track lead stages as the conversation develops."],
    ],
    example: ["Choose one service and one business challenge.", "Check the account research before preparing the message.", "Review the copy and sender configuration.", "Track replies and record the next discovery or proposal step."],
    pilot: "One SAP or ERP service, one geography and one defined buyer group.",
    limits: "CraftMyFunnel does not implement ERP systems and has no access to SAP's customer lists or proprietary ERP buying signals.",
    notFit: "Teams seeking ERP implementation delivery, proprietary install-base data or autonomous outbound.",
    faq: [
      { q: "Does it know which companies still run ECC?", a: "No. Select accounts with your own research and validate relevance before outreach." },
      { q: "Does this implement SAP or ERP systems?", a: "No. It supports the commercial workflow around your own services." },
    ],
  },
  {
    slug: "gcc-services",
    name: "GCC workplace services",
    market: "india",
    title: "New GCCs need facilities, security and support from day one. Reach them while they're setting up.",
    lead: "India adds more than two Global Capability Centres a week. For facility management, security and workplace service providers, the vendor shortlist forms early. Turn expansion signals into reviewed outreach and owned follow-up.",
    whyNow: {
      title: "The GCC build-out is ahead of schedule, and every new centre is a services contract.",
      stats: [
        { value: "2,117", text: "GCCs in India as of March 2026, employing 2.36 million people." },
        { value: "183", text: "new GCC units added in the first half of 2026 alone." },
        { value: "2+ / week", text: "new GCCs entering India, plus brownfield expansion of existing ones." },
      ],
      source: "Sources: Nasscom–Zinnov GCC Landscape, May 2026; CXO Digital Pulse, 2026; Zinnov via The Core, 2026.",
    },
    buyer: "Business development heads at integrated facility management, security services, workplace and fit-out firms.",
    challenge: "By the time a GCC issues an RFP, the shortlist is often already set. The signal (a lease, a hiring push, a new site) arrives early; the follow-up usually doesn't.",
    situations: [
      ["A new centre is announced", "Capture the account and assign an owner the same week."],
      ["Several services, one buyer", "Coordinate facilities, security and staffing conversations on one record."],
      ["The site visit went well, then silence", "Stuck leads surface with history and a suggested next move."],
    ],
    example: ["Pick one city and one service line, e.g. IFM for new GCCs in Hyderabad.", "Review expansion and hiring signals your team has validated.", "Approve a short, specific first message on email, LinkedIn or WhatsApp where consent allows.", "Hand warm replies to a caller with the full timeline."],
    pilot: "One city, one service line and a small set of validated GCC accounts.",
    limits: "Buyer Signals can watch hiring and expansion sources where configured, but every account should be validated by your team. CraftMyFunnel does not guarantee access to lease or permit data in every city.",
    notFit: "Teams that only respond to public tenders and do not want proactive outreach.",
    faq: [
      { q: "Does it list every new GCC automatically?", a: "No. It surfaces signals from configured sources. Your team validates accounts before outreach." },
      { q: "Can we use WhatsApp?", a: "Only where the recipient has given consent and your account has the integration configured. Email and LinkedIn are the usual first touch." },
    ],
  },
  {
    slug: "staffing",
    name: "Staffing & recruitment",
    market: "india",
    title: "Hiring surges are your best sales signal. Act on them in days, not weeks.",
    lead: "GCCs and expanding enterprises hire in waves. Staffing and RPO firms that reach the hiring manager during the surge win the mandate. Keep signal, outreach and follow-up in one governed flow.",
    whyNow: {
      title: "India's capability-centre workforce keeps compounding.",
      stats: [
        { value: "2.36M", text: "people employed by GCCs in India as of March 2026." },
        { value: "600,000", text: "new direct GCC jobs added in the five years to FY26." },
        { value: "76%", text: "of all new GCCs worldwide over five years were set up in India." },
      ],
      source: "Sources: Nasscom–Zinnov, 2026; HFS Research, 2026.",
    },
    buyer: "Founders, BD leads and account directors at staffing, RPO and executive search firms.",
    challenge: "A job-posting spike is visible to every agency at once. The firm that follows up with a relevant, specific message, and then follows up again, gets the conversation.",
    situations: [
      ["Ten roles posted in two weeks", "Flag the account and prepare a role-specific draft for review."],
      ["Recruiters and BD both touch the client", "One timeline shows every message and call."],
      ["A hiring manager replied once, then went quiet", "Scheduled follow-up keeps the thread warm without guesswork."],
    ],
    example: ["Choose one role family, e.g. finance operations hiring at GCCs.", "Review accounts with recent hiring activity your team has checked.", "Approve a short message that references the roles, not a generic pitch.", "Track replies and book the intake call."],
    pilot: "One role family, one city and a small set of hiring accounts.",
    limits: "CraftMyFunnel does not scrape candidate data or source candidates. It supports the client-acquisition side only.",
    notFit: "Teams looking for a candidate database, ATS or sourcing tool.",
    faq: [
      { q: "Is this an ATS?", a: "No. It handles client acquisition and follow-up, not candidates." },
      { q: "Where do hiring signals come from?", a: "From configured public sources such as company job pages. Validate each account before outreach." },
    ],
  },
  {
    slug: "dpdp-consulting",
    name: "Privacy, DPDP & IT consulting",
    market: "india",
    title: "Every Indian business has a privacy deadline. Help them meet it. Reach them first.",
    lead: "The DPDP Rules start enforcement in May 2027, with no exemption for company size. Privacy, legal-tech and IT consultancies can run focused, consent-aware outreach and keep every advisory conversation moving.",
    whyNow: {
      title: "2026 is the build year. 2027 is enforcement.",
      stats: [
        { value: "13 Nov 2025", text: "DPDP Rules notified, starting an 18-month compliance runway." },
        { value: "13 May 2027", text: "full compliance deadline for consent, notice, security and breach obligations." },
        { value: "Every size", text: "applies to any entity processing digital personal data in India, with no exemption for size or stage." },
      ],
      source: "Sources: MeitY notification; Fisher Phillips, India Briefing and Treelife analyses, 2025–2026.",
    },
    buyer: "Partners and practice leads at privacy consultancies, law firms' tech practices and IT/GRC service providers.",
    challenge: "Everyone is sending the same 'DPDP is coming' email. The work is finding the accounts that are actually exposed and following up with something specific.",
    situations: [
      ["Generic deadline emails get ignored", "Prepare drafts that reference the account's own business context."],
      ["Advisory deals take several conversations", "Track stages and owners across months, not days."],
      ["You need to practise what you sell", "Approval logs and consent handling show your outreach is governed too."],
    ],
    example: ["Pick one segment, e.g. mid-size fintech or healthtech firms.", "Research accounts and their likely data-processing footprint.", "Approve a short, specific first message.", "Book the readiness call and log the next step."],
    pilot: "One segment, one service (e.g. a DPDP readiness review) and a small researched account set.",
    limits: "CraftMyFunnel is not legal advice and does not assess a prospect's DPDP compliance.",
    notFit: "Firms wanting a compliance-management tool for their clients rather than a sales workflow.",
    faq: [
      { q: "Is CraftMyFunnel itself DPDP-ready?", a: "See our Privacy and Security pages for current controls. Consent handling and approval logs are part of the product; confirm specifics for your use case with our team." },
      { q: "Does it tell me which companies are non-compliant?", a: "No. Use your own research and qualification." },
    ],
  },
  {
    slug: "b2b-saas",
    name: "B2B SaaS",
    market: "global",
    more: true,
    title: "Your pipeline stalls between interested and booked. Fix the follow-up.",
    lead: "Prepare researched accounts, review every draft and see which replies deserve a person today, for software teams selling to a considered buyer.",
    whyNow: { title: "Follow-up clarity decides which interested accounts become meetings.", stats: [], source: "" },
    buyer: "Founders and sales heads at B2B software companies with a small outbound team.",
    challenge: "Leads arrive from several places, replies land in different inboxes and nobody can say which accounts are warm today.",
    situations: [
      ["Replies get lost", "See incoming replies with a suggested label, and decide who answers."],
      ["Drafts vary by rep", "AI prepares the draft from the account's context; a person reviews it before sending."],
      ["Nobody owns the next step", "Track stages and follow-up tasks on each lead's timeline."],
    ],
    example: ["Pick one product line and one customer profile.", "Prepare messages about each account's own context.", "Review every draft, then send.", "Sort replies and move stages as buyers respond."],
    pilot: "One product line, one customer profile and a small researched account set.",
    limits: "CraftMyFunnel does not guarantee replies or meetings, and nothing is sent without your review.",
    notFit: "Teams wanting high-volume unreviewed sending, or a self-serve product-led funnel tool.",
    faq: [
      { q: "Does it book meetings automatically?", a: "No. It records meetings against the lead. Booking through your calendar is a separate step." },
      { q: "Can it send without review?", a: "No. Every draft is reviewed by a person first." },
    ],
  },
  {
    slug: "enterprise-services",
    name: "Enterprise services",
    market: "global",
    more: true,
    title: "Long deals go quiet between meetings. Keep every contact and next step in one place.",
    lead: "Built for consulting, advisory and managed-service teams whose deals involve several stakeholders over several months.",
    whyNow: { title: "Considered deals are won by consistent follow-up across many conversations.", stats: [], source: "" },
    buyer: "Partners and practice leads at consulting, advisory and managed-service firms.",
    challenge: "Each deal has many contacts and a long timeline. Notes sit in personal inboxes, and no one sees the whole account.",
    situations: [
      ["Several stakeholders per deal", "Keep every contact and conversation against the account."],
      ["Long gaps between touches", "Follow-up tasks and the activity timeline show what is due."],
      ["Messages must be careful", "A person reviews every draft before it goes out."],
    ],
    example: ["Pick one service and one account group.", "Map the contacts you already have at each account.", "Review and send a first message per contact.", "Track replies and next steps as they come in."],
    pilot: "One service, one account group and a few months of follow-up.",
    limits: "CraftMyFunnel organises outreach and follow-up. It does not run your sales process or judge deal quality.",
    notFit: "Firms that want a full CRM replacement or fully automated outbound.",
    faq: [
      { q: "Does it replace our CRM?", a: "It is an outreach and follow-up workspace. Use it beside your CRM as you see fit." },
      { q: "How long before we see anything?", a: "Long sales cycles take time. A narrow pilot on one service is the honest way to judge fit." },
    ],
  },
  {
    slug: "real-estate",
    name: "Real estate & developers",
    market: "global",
    more: true,
    title: "Enquiries arrive from everywhere. Answer each one properly, on time.",
    lead: "Keep enquiries, channel-partner conversations and follow-ups in one workflow, with a person reviewing every message.",
    whyNow: { title: "A fast, accurate first answer separates serious sellers from the rest.", stats: [], source: "" },
    buyer: "Sales heads at developers, brokerages and commercial real-estate advisers.",
    challenge: "Enquiries come from forms, portals and partners. Follow-up depends on who saw them first.",
    situations: [
      ["Enquiries are scattered", "Save each lead with its source and conversation history."],
      ["Partner conversations drift", "Track stages and owners for each partner and project."],
      ["Contact must be lawful", "You decide who is eligible. Consent handling is your responsibility."],
    ],
    example: ["Pick one project or partner programme.", "Import enquiries you are allowed to contact.", "Review every message before sending.", "Sort replies and record site visits and calls."],
    pilot: "One project or partner programme with a small, eligible contact set.",
    limits: "Only contact people who enquired or have a lawful basis. WhatsApp needs recorded consent. CraftMyFunnel does not check eligibility for you.",
    notFit: "Teams wanting to message purchased or scraped lists without consent.",
    faq: [
      { q: "Can it message buyers on WhatsApp?", a: "WhatsApp needs recorded consent and its setup status varies. Confirm what is enabled for your workspace before relying on it." },
      { q: "Who checks that a contact can be messaged?", a: "You do. Your team owns recipient eligibility and consent." },
    ],
  },
  {
    slug: "clinics",
    name: "Clinics & healthcare providers",
    market: "global",
    more: true,
    title: "Grow employer and referral partnerships without losing track of a conversation.",
    lead: "For clinics, diagnostics and healthcare groups that sell services to businesses and referrers. Every message is reviewed by a person.",
    whyNow: { title: "Partnership deals are slow, and every conversation needs a clear owner.", stats: [], source: "" },
    buyer: "Business-development and operations leads at clinics, diagnostics groups and multi-site providers.",
    challenge: "Employer and referral conversations run over weeks. Nobody sees where each one stands.",
    situations: [
      ["Many partner conversations", "Keep each employer or referrer with its history and next step."],
      ["Messages must be careful", "A person reviews every draft before it is sent."],
      ["Data must stay out", "Use business contacts only. Do not enter patient information."],
    ],
    example: ["Pick one service, such as employer health checks.", "Prepare a message for each business contact.", "Review every draft before sending.", "Track replies and meetings with each employer."],
    pilot: "One service, one city and a small set of business contacts.",
    limits: "Business contacts only. Never enter patient data or clinical records. CraftMyFunnel is not a medical-records system and makes no clinical or compliance claims.",
    notFit: "Anyone wanting to market to patients, or to store clinical or patient information.",
    faq: [
      { q: "Can we upload patient lists?", a: "No. Use CraftMyFunnel for business and referral contacts only." },
      { q: "Does this make us compliant?", a: "No. Your own legal and compliance review decides what you may send and store." },
    ],
  },
];

export const industryBySlug = (slug: string) => INDUSTRIES.find((i) => i.slug === slug);
