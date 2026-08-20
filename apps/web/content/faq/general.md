---
title: "Frequently Asked Questions"
description: "Comprehensive platform guide. Truth stated flat for B2B operators running governed outbound pipelines."
---

### Do I need to be technical?
No. You need judgment.

The machine does the typing. You do the deciding.

### Will automation make my outreach feel robotic?
Robotic outreach fails because nobody approved it.

Every message here waits for a human "yes" first. That is the whole point of governed.

### Is this just another tool to learn?
Tools ask you to learn them.

CraftMyFunnel asks you what you want, then gets out of your way.

### Why not let AI send everything autonomously?
Autonomous outreach burns sending domains and kills credibility.

Signals disappear. Follow-ups stall. Deals die between unreviewed messages. When a manager clears the draft before dispatch, deal quality stays protected.

### How does the Human-in-the-Loop approval queue work?
Every draft surfaces in a single batch review queue with the prospect's live LinkedIn snapshot and signal context.

You approve, edit inline, adjust the sending mailbox, or reject in seconds. When cleared, the Transactional Outbox dispatches the email. Nothing leaves your mailbox unchecked.

### Can reps edit AI drafts before sending?
Yes. Every word is editable.

Reps tweak sentences inline directly in the review queue. Edits are recorded to refine future draft generation for that campaign.

### How does CraftMyFunnel generate personalized drafts?
Contextual multi-model synthesis.

The AI engine analyzes the prospect's role, company industry, and recent activity signals against your campaign playbook. It drafts a short, focused message grounded in why you are reaching out today.

### What happens when a draft is rejected?
The draft is discarded and the lead is marked rejected or deferred.

No email is sent. No credit is wasted on dispatch. You decide whether to re-queue the lead with a different angle or archive it.

### What buyer signals does NetJana track?
Live market intent.

NetJana monitors hiring surges, office expansions, leadership appointments, and commercial permit filings. Your team works accounts actively in market instead of cold, stale lists.

### How does LinkedIn contact ingestion work?
Via our Scraper Bridge extension and verified imports.

Capture prospect profiles directly from LinkedIn Sales Navigator. Context flows into your shared funnel with full team visibility.

### Can we upload existing CSV prospect lists?
Yes. Clean ingestion in seconds.

Upload CSV files with custom column mapping. The system deduplicates contacts, normalizes fields, and prepares review-ready drafts according to your selected playbook.

### Which outreach channels are live today?
Google Workspace and Gmail accounts via secure OAuth. Custom SMTP/IMAP connections are also supported.

Multi-channel LinkedIn messaging, WhatsApp touchpoints, and voice tasks are staged in Phase 2 workflows.

### What is the Human Layer and how do caller tasks work?
The deals digital channels cannot close, your people do.

When an email sequence stalls or a high-value account engages, CraftMyFunnel surfaces a stage-specific caller task with talking points and historical touchpoint context.

### How does inbound reply detection work?
Through our lease-locked Gmail PubSub synchronization engine.

When a prospect replies, the platform captures the wire thread, classifies response sentiment, updates lead status, and pauses subsequent automated sequence steps instantly.

### How does CraftMyFunnel protect sending domain health?
At the wire level with four hard guardrails:
1. **RFC 5322 Message-ID Threading**: Synchronizes exact wire headers post-send for accurate reply matching.
2. **RFC 8058 One-Click Unsubscribe**: Embeds compliant headers so recipients opt out without marking spam.
3. **5% Bounce Circuit Breakers**: Automatically pauses mailboxes that hit delivery friction.
4. **Daily Mailbox Velocity Caps**: Distributes sends with human-like randomized intervals.

### How does deterministic HMAC-SHA256 blind indexing work?
Zero plaintext exposure for prospect PII.

Sensitive fields like email and phone are encrypted at rest with AES-256. For search, we compute deterministic HMAC-SHA256 hashes salted per workspace. Your team queries exact matches without decrypting the database or leaking data to third parties.

### What is the Transactional Outbox pattern?
Guaranteed event delivery with zero dropped actions.

Domain updates and OutboxEvent records commit together in a single atomic database transaction. Background relay workers poll and dispatch with lease locks and idempotency keys. If a worker crashes, the event retries safely without duplicate sends.

### How is multi-tenant data isolated?
Strict cryptographic scoping.

Every query enforces a server-verified `teamId` extracted from authenticated JWT sessions. Cross-tenant data access is blocked at the database and API boundary.

### How do credits and monthly quotas work?
Transparent pay-for-what-you-use budgeting.

Workspaces receive monthly credit allocations for lead enrichment, AI draft generation, and sequence processing. Requests estimate credits upfront and settle actual usage upon execution.

### Can admins set per-user credit caps?
Yes. Strict budget controls.

Admins configure monthly credit allowances per team member to prevent accidental overages. When a quota is reached, new generations pause until replenished.

### What are Vertical Outbound Playbooks?
Pre-calibrated sequence blueprints engineered for specific B2B service sectors: facility management, physical security, staffing, corporate L&D, consulting, and managed IT.

They embed proven stage cadences, qualification criteria, and messaging angles so operators launch in minutes.

### Who is CraftMyFunnel built for?
Operators running real B2B service teams.

If you blast 50,000 spam emails a day to sell cheap software, look elsewhere. If you sell high-value contracts, manage client trust, and need governed pipeline control, welcome.
