// Sample funnels shown on industry pages. Everything here is FICTIONAL and illustrative: invented people and
// companies, no results, no rates. Each walkthrough shows only what the product does today (email-first,
// every draft reviewed by a person). Do not add numbers, client names or channel claims without checking
// docs/ and GEMINI.md section 14 first.
export type Sandbox = {
  prospect: { name: string; role: string; company: string; source: string };
  /** Criteria the sample lead matches, in plain words. No scores. */
  icp: string[];
  draft: { subject: string; body: string };
  reply: { text: string; label: string };
  stage: { from: string; to: string };
  meeting: { title: string; note: string };
  /** Niche-specific caution shown under the walkthrough. */
  watch: string;
};

export const SANDBOXES: Record<string, Sandbox> = {
  cybersecurity: {
    prospect: { name: "Priya Nair", role: "Head of Compliance", company: "Harlow Payments (sample)", source: "Sample list import" },
    icp: ["Regulated financial entity", "50 to 500 staff", "No managed security partner listed", "Based in an EU member state"],
    draft: { subject: "A first step for your NIS2 gap review", body: "Hi Priya, Harlow's recent expansion into two new markets usually widens the regulatory surface. We run a short gap assessment for mid-size payment firms. Would a 20-minute walk-through be useful?" },
    reply: { text: "Interesting timing. Can you send what the assessment covers?", label: "Interested" },
    stage: { from: "Cold", to: "Warm" },
    meeting: { title: "Gap assessment scoping call", note: "Recorded by the rep after the call was agreed." },
    watch: "Scope depends on the prospect's sector and member-state rules. CraftMyFunnel does not decide who is in scope.",
  },
  "b2b-saas": {
    prospect: { name: "Marcus Bell", role: "VP Sales", company: "Brightpath Software (sample)", source: "Sample list import" },
    icp: ["B2B software company", "Sales team of 5 to 30", "Selling to mid-market buyers", "Hiring for sales roles"],
    draft: { subject: "Fewer deals stalling after the first call", body: "Hi Marcus, I noticed Brightpath is hiring two account executives. Teams scaling like that often lose track of who is warm. We help keep replies, owners and next steps in one place. Open to seeing how?" },
    reply: { text: "We do have that problem. What does setup look like?", label: "Interested" },
    stage: { from: "Cold", to: "Warm" },
    meeting: { title: "Pipeline review walk-through", note: "Recorded by the rep. Calendar booking is separate." },
    watch: "Replies and meetings are never guaranteed. The sample shows the mechanism, not a result.",
  },
  "enterprise-services": {
    prospect: { name: "Anita Rao", role: "Practice Lead", company: "Meridian Advisory (sample)", source: "Sample list import" },
    icp: ["Considered B2B service", "Several stakeholders per deal", "Sales cycle of months", "Existing referral-led pipeline"],
    draft: { subject: "Keeping long deals moving between meetings", body: "Hi Anita, advisory deals with several stakeholders tend to go quiet between meetings. We help teams track every contact, the last touch and the agreed next step. Worth a short conversation?" },
    reply: { text: "Our follow-up is scattered across inboxes. Yes, let's talk.", label: "Interested" },
    stage: { from: "Cold", to: "Warm" },
    meeting: { title: "Discovery conversation", note: "Recorded by the rep after the time was agreed." },
    watch: "Long cycles mean slow results. A narrow pilot on one service is the honest way to judge fit.",
  },
  "real-estate": {
    prospect: { name: "Rohan Mehta", role: "Sales Head", company: "Skyline Developers (sample)", source: "Enquiry form (sample)" },
    icp: ["Residential or commercial developer", "Active launch this year", "Enquiries arrive from several sources", "Dedicated sales team"],
    draft: { subject: "Following up on your enquiry", body: "Hi Rohan, thanks for asking about our channel-partner programme. Here is a short summary and two times this week to talk it through." },
    reply: { text: "Please share the details and call me Thursday.", label: "Interested" },
    stage: { from: "Cold", to: "Warm" },
    meeting: { title: "Partner programme call", note: "Recorded by the rep. Calendar booking is separate." },
    watch: "Only contact people who enquired or have a lawful basis to be contacted. WhatsApp needs recorded consent and is not part of this sample.",
  },
  clinics: {
    prospect: { name: "Dr. Leena Shah", role: "Operations Director", company: "Cedar Wellness Group (sample)", source: "Sample list import" },
    icp: ["Multi-site clinic or diagnostics group", "Sells to employers or referrers", "Has a business-development contact", "Based in one metro area"],
    draft: { subject: "Employer health-check partnerships", body: "Hello Dr. Shah, Cedar's corporate wellness programme looks well suited to employers in your area. We help teams keep each employer conversation and next step organised. Open to a brief chat?" },
    reply: { text: "We are expanding employer partnerships. Send some times.", label: "Interested" },
    stage: { from: "Cold", to: "Warm" },
    meeting: { title: "Partnership intro call", note: "Recorded by the rep after the call was agreed." },
    watch: "Business contacts only. Never enter patient data or clinical records. CraftMyFunnel is not a medical-records system and makes no clinical or compliance claims.",
  },
};
