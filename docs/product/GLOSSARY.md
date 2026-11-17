# Glossary: one name per thing

Use the "Say" column in UI and docs. Codes stay as they are in data; only display changes.
Facts from code on 2026-11-16. For tone, see `docs/BRAND_VOICE_GUIDELINES.md`.

## Pipeline stages (`Lead.pipelineState`)

| Code | Say |
|---|---|
| COLD | Cold |
| WARM | Warm |
| HOT | Hot |
| COORDINATING | Coordinating |
| MEETING_CONFIRMED | Meeting confirmed |
| COMPLETED | Completed |

## Lead status (`Lead.status`, free string, default NEW)

| Code | Say |
|---|---|
| NEW | New |
| ENRICHED / enriched | Enriched |
| CONTACTED | Contacted |
| CONNECTED | Engaged |
| REPLIED | Replied |
| CONVERTED | Converted |
| LOST | Lost |
| STOPPED | Stopped |
| LINKEDIN_CAPTURED | From LinkedIn |

Unknown codes are shown as words ("SOME_STATUS" -> "Some status"), never raw.
Pipeline stage and lead status are two different fields. Do not mix them in one list.

## Home page terms

| Say | Means | Do not say |
|---|---|---|
| Meetings booked | Count of `Meeting` rows for the team | Meetings secured |
| Leads in outreach | Leads not rejected, opted out, bounced or unsubscribed | Active pipeline |
| Drafts waiting | Emails in draft or queued state | Drafts queued |
| Engagement rate | (opens + clicks + replies) / emails sent | Signals captured, open rate, reply rate |
| Reply rate | replies / sent, per channel | Engagement rate |
| Sign-off / approve | A human approving a pending request | Auto-approve, auto-send |
| Approval record | Past approve / reject decisions, no message text | Audit log (that is a different table) |

## Needs-you queue types

| Code | Say |
|---|---|
| unread_replies | Replies to answer |
| approvals | Waiting for your approval |
| approved_not_sent | Approved but not sent |
| stalled_leads | Leads gone quiet |
| mailbox_issues | Mailboxes to reconnect |
| meetings_today | Meetings today |

## Channels

Email, LinkedIn, WhatsApp, Calls. Write them exactly so.
Owner decision 2026-11-16: all four channels are for all users. Describe each only as far
as it works (GEMINI.md §14):
- WhatsApp sends from the team's own WhatsApp Business account after a consent check.
- LinkedIn and Calls hand a step to a person (a task or a call queue); do not say they
  send or call on their own.

## Outreach mode (setup step 1)

`personal` = "My own lead generation". `company` = "On behalf of a company".

## Open naming conflict (needs a human decision)

The on-premise device has two names in the repo: "Covospan EDGE"
(`craftmyfunnel-product-narrative.md`, `craftmyfunnel-uiux-overhaul.md`) and
"Sovereign Wall edge node" (setup wizard, `docs/SOVEREIGN_WALL_INTEGRATION.md`).
Until decided, UI says "Edge node" and nothing more.

## Claims wording

Follow "Product Claim Guardrails" in `AGENTS.md`: prepares, supports, tracks, review-ready,
human approval. Never: guaranteed meetings, fully autonomous, sends on its own.
