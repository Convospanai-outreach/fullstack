# Setup wizard: the 15 steps

Source: `apps/web/src/app/setup/page.tsx`, `apps/web/src/lib/setupSteps.ts`.
Facts from code on 2026-11-16. The "Needed for first send" column is NOT audited yet;
fill it only from a code-proven audit, never by guess.

Shown in this order. Ids are fixed: deep links like `/setup?step=3` depend on them.

| Order | Id | Title in code | What it asks | Personal mode | Needed for first send |
|---|---|---|---|---|---|
| 1 | 1 | Launch Brief | Who you reach out for; data responsibility notice | shown | not audited |
| 2 | 2 | Workspace Identity | Brand details | hidden | not audited |
| 3 | 15 | Scan Your Website | Read website to draft ICP and messaging. Optional | shown | not audited |
| 4 | 3 | Sending Mailbox | Google Workspace, Microsoft 365, SMTP or Resend | shown | not audited |
| 5 | 4 | Outreach Connectors | Email, LinkedIn, Meta, WhatsApp | shown | not audited |
| 6 | 5 | Message Voice | Tone, greeting, signoff, review guidance | shown | not audited |
| 7 | 6 | AI Drafting | Provider key | shown | not audited |
| 8 | 7 | Lead Inputs | Import leads | shown | not audited |
| 9 | 8 | Campaign Plan | First campaign workflow | shown | not audited |
| 10 | 9 | Meeting Assets | Calendar and proof links | shown | not audited |
| 11 | 10 | Commercial Readiness | Credits or billing | shown | not audited |
| 12 | 11 | Handoffs | Optional infrastructure integrations | hidden | not audited |
| 13 | 12 | Notifications | Email and in-app alerts | shown | not audited |
| 14 | 13 | Invite Your Team | Add teammates | hidden | not audited |
| 15 | 14 | Test Your Domains | DNS check for email and landing pages | shown | not audited |

## Fixed behaviour

- `/dashboard` redirects to `/setup` until the team has chosen an outreach mode
  (personal or company), for members and above.
- Step 1's data responsibility notice is mandatory. Its version is `DATA_RESPONSIBILITY_VERSION`
  in `setupSteps.ts`; the API route and tests read the same value.
- Personal mode hides steps 2, 11 and 13 (`PERSONAL_HIDDEN_STEPS`).
- Next and previous go by position in the visible list, not by id.
- Marked optional in the UI today: website scan, WhatsApp Business API, reply capture,
  monthly meeting goal, edge node.

## Rules for changing it

No step is deleted. Ids do not change. What a step saves does not change.
Order, titles, descriptions and "do this later" are allowed with approval.
