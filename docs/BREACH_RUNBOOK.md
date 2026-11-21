# Personal data breach runbook

Status: draft. Every step that states a legal duty is marked **[LAWYER REVIEW]** and must be confirmed by a lawyer before this is relied on.

## Who does what

CraftMyFunnel processes leads' personal data for its customers. The customer decides why and how that data is used (the data fiduciary); CraftMyFunnel acts for them (the processor). **[LAWYER REVIEW]**

| Role | Does |
|---|---|
| Incident lead | Owns the incident from detection to close. Decides when each step is done. Writes the timeline. |
| Engineer on call | Finds out what happened, stops it, keeps evidence. |
| Customer contact | The one person who talks to the affected customer. Sends the alert and answers their questions. |
| Legal reviewer | Confirms what the customer must be told and by when. Reviews every notice before it goes out. |

One person can hold more than one role in a small incident. Write down who holds which role at the start.

## The steps

### 1. Detect
- [ ] Note the time and how it was found (alert, customer report, our own review). Write it in the incident timeline.
- [ ] Name an incident lead.
- [ ] Decide whether personal data may be involved. If unsure, treat it as a breach until shown otherwise.

### 2. Contain
- [ ] Stop the cause: revoke the leaked key or token, close the exposed endpoint, disable the affected account.
- [ ] Keep evidence: logs, the AuditLog rows, copies of what was exposed. Do not delete anything.
- [ ] Rotate any secret that may have been seen.
- [ ] Record what was done and when.

### 3. Find out what was affected
- [ ] Which customers (teams) and which data (names, emails, phone numbers, message content).
- [ ] Over what period.
- [ ] For each affected team, run the breach export (see "Exporting the affected leads" below) for that period. The export is recorded in the AuditLog.

### 4. Alert the customer, within hours
- [ ] The customer contact sends the customer the alert notice (see `BREACH_NOTICE_TEMPLATES.md`) within **[SET: number of hours, from the lawyer]** of the incident lead confirming a breach. **[LAWYER REVIEW]**
- [ ] The alert says what happened, which data, which period, what we have done, and what we recommend the customer does.
- [ ] Send the export to the customer by a secure route, not as a plain email attachment.
- [ ] Record when it was sent and who received it.

### 5. The customer tells the affected people and the Board
These duties belong to the customer. We help them meet them. **[LAWYER REVIEW]**
- [ ] The customer tells each affected person without delay. The notice templates are a starting point the customer edits. Nothing is sent automatically by CraftMyFunnel.
- [ ] The customer sends the Data Protection Board a detailed report within 72 hours. We give the customer the facts they need for it: timeline, cause, data, period, containment, and fixes.

### 6. Close
- [ ] Confirm the cause is fixed and checked.
- [ ] Write the post-incident review: what happened, what worked, what did not, what changes.
- [ ] Keep the timeline, the exports' AuditLog rows and the notices together.

## Exporting the affected leads

A super admin can export the leads one team held that were created in a time window.

`GET /admin/super/breach-export?teamId=<team id>&from=<ISO date>&to=<ISO date>`

- Super admin only. Anyone else gets 403 and nothing is read.
- The result is a CSV: id, full name, email, phone, company, source, created at.
- Each export writes an AuditLog row (`BREACH_EXPORT`) for that team, naming the admin, the window and the number of leads. The row is written before any data is read; if it cannot be written, nothing is exported. The row holds no lead data.
- "Affected" is read as "created in the window". If the exposure covered older leads, widen `from`.
- Treat the file as sensitive. Share it only with the customer, delete local copies when the incident closes.

## Checklist for the incident lead (one page)

1. Time found, who found it, incident lead named.
2. Cause stopped, secrets rotated, evidence kept.
3. Teams, data and period listed.
4. Exports run and recorded.
5. Customer alerted within the agreed hours, and the time written down.
6. Customer has the facts for their notices and the Board report.
7. Cause fixed, review written.
