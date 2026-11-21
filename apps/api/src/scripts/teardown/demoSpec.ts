import type { TeardownSpec } from './build';

/**
 * The MCP directory-review demo workspace. Its ids are pinned (PINNED_IDENTITIES in build.ts) to what the original seed
 * script wrote to production (demo-mcp-*), so re-running updates those rows in place instead of creating copies.
 */
export const DEMO_SPEC: TeardownSpec = {
  slug: 'demo-mcp', prospect: 'CraftMyFunnel Demo', credits: 100,
  offer: 'Outreach workspace with human review of every message.',
  icp: { name: 'Demo: B2B SaaS sales leaders', description: 'Fictional example profile for directory review.',
    criteria: { titles: ['VP Sales', 'Head of Growth', 'CRO'], industries: ['B2B SaaS', 'Logistics'], companySize: '50-500', regions: ['US', 'UK'] } },
  campaigns: [
    { name: 'Demo: Q4 SaaS pipeline push', description: 'Draft campaign created from the demo ICP. Nothing is sent.', status: 'draft' },
    { name: 'Demo: Logistics outreach (paused)', description: 'Paused example campaign with a few attached leads.', status: 'paused' },
  ],
  leads: [
    { name: 'Asha Verma', title: 'VP Sales', company: 'Northwind Logistics (demo)', domain: 'northwind-demo.example', stage: 'COLD', campaign: 2 },
    { name: 'Ben Carter', title: 'Head of Growth', company: 'Brightpath Software (demo)', domain: 'brightpath-demo.example', stage: 'COLD' },
    { name: 'Chen Li', title: 'Sales Director', company: 'Harbor Freight Tech (demo)', domain: 'harbor-demo.example', stage: 'COLD' },
    { name: 'Dana Ortiz', title: 'CRO', company: 'Lumen Analytics (demo)', domain: 'lumen-demo.example', stage: 'WARM', campaign: 2 },
    { name: 'Elif Demir', title: 'VP Revenue', company: 'Cedar Ops (demo)', domain: 'cedar-demo.example', stage: 'WARM' },
    { name: 'Femi Adeyemi', title: 'Founder', company: 'Orbit Payments (demo)', domain: 'orbit-demo.example', stage: 'WARM' },
    { name: 'Grace Kim', title: 'Head of Sales', company: 'Pinecrest Health IT (demo)', domain: 'pinecrest-demo.example', stage: 'HOT', value: 12000, campaign: 2 },
    { name: 'Hugo Martin', title: 'COO', company: 'Delta Fleet (demo)', domain: 'deltafleet-demo.example', stage: 'HOT', value: 8000 },
    { name: 'Isha Rao', title: 'Sales Ops Lead', company: 'Quanta Retail (demo)', domain: 'quanta-demo.example', stage: 'COORDINATING', value: 15000 },
    { name: 'Jonas Weber', title: 'VP Sales', company: 'Alpine Industrial (demo)', domain: 'alpine-demo.example', stage: 'MEETING_CONFIRMED', value: 20000, campaign: 2 },
    { name: 'Kara Singh', title: 'Director of Partnerships', company: 'Vertex Cloud (demo)', domain: 'vertex-demo.example', stage: 'MEETING_CONFIRMED', value: 18000 },
    { name: 'Leo Novak', title: 'Head of Revenue', company: 'Maple Ledger (demo)', domain: 'mapleledger-demo.example', stage: 'COMPLETED', value: 9000 },
  ],
  activities: [
    { lead: 7, channel: 'EMAIL', type: 'CONTACTED', title: 'Intro email (demo)', notes: 'Fictional example activity.', ageDays: 6 },
    { lead: 7, channel: 'EMAIL', type: 'REPLIED', title: 'Replied (demo)', notes: 'Asked about pricing.', ageDays: 4 },
    { lead: 9, channel: 'LINKEDIN', type: 'CONTACTED', title: 'Connection note (demo)', notes: 'Fictional example activity.', ageDays: 5 },
    { lead: 10, channel: 'CALL', type: 'CONTACTED', title: 'Discovery call booked (demo)', notes: 'Fictional example activity.', ageDays: 2 },
  ],
  thread: { lead: 7, messages: [
    { direction: 'OUTBOUND', sender: 'Demo Rep', content: 'Hi Grace, I noticed Pinecrest is hiring SDRs. We help sales teams review every outreach draft before it goes out. Open to a short chat? (Demo message)', ageDays: 6 },
    { direction: 'INBOUND', sender: 'Grace Kim', content: 'Sounds relevant. What does pricing look like for a team of 8? (Demo message)', ageDays: 4 },
  ] },
  tasks: [
    { title: 'Demo: send pricing to Grace Kim', lead: 7, priority: 'HIGH', dueInDays: 1 },
    { title: 'Demo: follow up with Isha Rao', lead: 9, priority: 'MEDIUM', dueInDays: 3 },
    { title: 'Demo: review draft campaign copy', priority: 'LOW', dueInDays: 5 },
  ],
  meeting: { title: 'Demo: discovery call with Alpine Industrial', lead: 10, startInDays: 2, minutes: 30, notes: 'Fictional example meeting record.' },
  template: { name: 'Demo: short intro', subject: 'Quick idea for {{company}}', body: 'Hi {{firstName}},\n\nExample template for directory review.\n\nBest,\nDemo Rep' },
  knowledge: { name: 'Demo: product FAQ', description: 'Fictional example knowledge base.',
    item: 'Demo FAQ: CraftMyFunnel drafts outreach and holds every message for human review before it is sent.' },
};
