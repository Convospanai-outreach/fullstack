# Data sources: where each number on Home comes from

Rule (GEMINI.md §1.2, §1.3): every number is a real, team-scoped query. If the data does
not exist, show a blank state. Never wire a number to something arbitrary.
For system-level sources of truth (mailbox, channel status, AI key), see GEMINI.md §8.
Facts from code on 2026-11-16.

## `/api/dashboard/summary` (apps/web, `src/app/api/dashboard/summary/route.ts`)

| On screen | Field | Query |
|---|---|---|
| Meetings booked | `kpis.meetingsBooked` | `meeting.count` for team |
| Leads in outreach | `kpis.activeLeads` | `lead.count`, status not REJECTED / OPT_OUT / BOUNCED / UNSUBSCRIBED |
| Drafts waiting | `kpis.draftsReady` | `email.count`, status draft / draft_ready / queued |
| "Needs your approval" note | `kpis.draftsPendingSend` | `approvalRequest.count`, status PENDING |
| Engagement rate | `kpis.openRatePct` | `emailEvent` OPENED + CLICKED + REPLY_RECEIVED, divided by emails with status sent |
| Pipeline trend | `pipelineTrend` | cumulative leads by `createdAt`, last 30 days |
| Recent leads | `recentLeads` | 5 leads by `updatedAt` |
| Activity feed | `recentActivity` | 10 latest `leadActivity` |
| Setup percent | `setupPercent` | 25 each: connected mailbox, any lead, any campaign, organization policy |

Known limits:
- `meetingsDelta` and `openRateDelta` are always 0. No period comparison is computed.
- "Last activity" on recent leads is `Lead.updatedAt`, not a real touch time.
- This route also writes: it backfills missing `ApprovalRequest` rows for draft emails on
  every load. Do not change that without approval.

## `/api/dashboard/overview` (apps/web, `src/app/api/dashboard/overview/route.ts`)

Read-only. Home hides these sections if it fails.

| On screen | Query |
|---|---|
| Pipeline stages | `lead.groupBy(pipelineState)` for team |
| Email sent, 7 days | `email.count`, status sent, `createdAt` in window |
| Email replies, 7 days | `emailEvent.count`, type REPLY_RECEIVED |
| LinkedIn contacted / replied, 7 days | `leadActivity.groupBy(leadId)`, channel LINKEDIN / linkedin: contacted = types LINKEDIN_OUTREACH_DONE, LINKEDIN_CONTACTED or LINKEDIN_REPLIED, replied = LINKEDIN_REPLIED. Only what a person logged on a lead; nothing captures LinkedIn replies automatically. |
| WhatsApp sent, 7 days | `whatsAppMessage.count`, direction OUTBOUND |
| WhatsApp replies, 7 days | `whatsAppMessage.count`, direction INBOUND |
| Calls made / conversations, 7 days | `leadActivity.groupBy(leadId)`, channel CALL / call: made = types CALL_CONTACTED or CALL_REPLIED, conversations = CALL_REPLIED. Written when a caller completes a call task (`CallerService.completeTask`) or a person marks a CALL step on the lead. |
| Approval record | 5 latest `approvalRequest` not PENDING: action type, status, time, reviewer name |

WhatsApp counts are scoped to the team through the lead (`lead: { teamId }`);
`WhatsAppMessage` has no `teamId` of its own and no delivery status. "Sent" time is `createdAt`.

The approval record never returns `payload`, so no message text or lead data leaves the route.

## Other Home sources

| On screen | Source |
|---|---|
| Needs-you queue and headline | `/api/proxy/dashboard/needs-you` -> apps/api `modules/inbox/needsYouService` (`collectNeedsYou`). Entries carry title, detail, href, time only. |
| Monthly meeting goal | apps/api `/dashboard/meeting-goal` -> `modules/inbox/meetingGoalService` |
| Edge status chip | apps/api `/edge/details`, polled every 60 s, from the node's last heartbeat |

## Not tracked yet (show a blank state, never a number)

- LinkedIn replies: only replies a person marked on a lead are counted. No automatic reply capture exists.
- Calls: counts only calls a person logged. Nothing dials, so there is no call duration or connect rate.
- Email sent time: `Email` has no sent timestamp. The 7-day window uses `createdAt`.
- Draft text in the needs-you queue: entries have no body. It lives in `ApprovalRequest.payload`.
- Lead-to-step mapping for the six-step governed workflow: does not exist in data.
- Period-over-period deltas for any KPI.
