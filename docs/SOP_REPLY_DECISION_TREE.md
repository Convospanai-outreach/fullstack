# SOP: Email Reply Decision Tree & Response Protocol

## 1. Objective
To standardize the classification and handling of incoming email replies from outreach campaigns, ensuring consistent, high-quality engagement while leveraging AI automation with Human-in-the-Loop (HITL) oversight.

## 2. Scope
This SOP applies to all replies received via the SendPulse integration for active outreach campaigns.

## 3. Decision Tree Categories

Incoming replies are classified into one of the following Intent Categories:

### A. Positive Interest (Hot Lead)
*   **Definition:** Prospect expresses clear interest in the product/service or agrees to a meeting.
*   **Keywords/Signals:** "Interested", "Let's talk", "Demo", "Pricing?", "Calendar", "Send more info".
*   **Mandatory Action:**
    1.  **Stop Automation:** Pause the automated follow-up sequence immediately.
    2.  **Notification:** Alert the Account Executive (AE) / Operator via High Priority Channel.
    3.  **Draft Response:** Agent drafts a booking link or answers the specific question.
    4.  **Goal:** Book a meeting within 4 hours.

### B. Soft Interest / Information Request (Warm Lead)
*   **Definition:** Prospect asks a clarifying question or objections that can be handled.
*   **Keywords/Signals:** "How does it work?", "Integration?", "Is this compliant?", "Case studies?".
*   **Mandatory Action:**
    1.  **Stop Automation:** Pause sequence.
    2.  **Analysis:** Retrieve relevant sales collateral/docs (RAG).
    3.  **Draft Response:** Agent drafts a helpful, value-add response addressing the specific query.
    4.  **Review:** Requires HITL approval before sending.

### C. Objection / Not Interested (Cold)
*   **Definition:** Prospect explicitly declines or states they are not a fit.
*   **Keywords/Signals:** "Not interested", "No thanks", "We have a solution", "Too expensive".
*   **Mandatory Action:**
    1.  **Mark Status:** Update CRM status to "Lost" or "Nurture" (if objection is temporal e.g., "Not now").
    2.  **Stop Automation:** Remove from current campaign.
    3.  **Draft Response:** (Optional) "Thanks for letting us know. We'll keep you in mind for future." (Polite close).

### D. Out of Office (OOO) / Auto-Reply
*   **Definition:** Automated system response.
*   **Keywords/Signals:** "Automatic reply", "Out of the office", "Vacation".
*   **Mandatory Action:**
    1.  **Snooze:** Reschedule the next follow-up step to `Return Date + 1 Day`.
    2.  **Log:** Note the return date in the CRM.

### E. Do Not Contact (DNC) / Unsubscribe
*   **Definition:** Prospect demands to be removed or is hostile.
*   **Keywords/Signals:** "Unsubscribe", "Remove me", "Spam", "Stop emailing".
*   **Mandatory Action:**
    1.  **Blacklist:** Immediately add to the Global Suppression List (SendPulse & Internal DB).
    2.  **Stop Automation:** Cancel all future tasks.
    3.  **No Response:** Do NOT reply.

## 4. Agentic AI Workflow

### Step 1: Ingest & Classify
*   **Trigger:** New inbound email webhook from SendPulse.
*   **Agent Task:** `ReplyAnalyzerAgent` processes the email body.
*   **Input:** Email Subject, Body, Sender History.
*   **Process:**
    *   Determine **Intent Category** (A-E).
    *   Extract **Entities** (Dates, Competitors, Questions).
    *   Assign **Confidence Score** (0-100%).

### Step 2: Determine Action
*   **Logic:**
    *   IF Category == DNC OR OOO: -> **Auto-Execute** (No Human Needed).
    *   IF Category == Positive (Confidence > 90%): -> **Draft & Notify**.
    *   IF Category == Positive (Confidence < 90%) OR Soft Interest OR Objection: -> **Draft & Request HITL Review**.

### Step 3: Human-in-the-Loop (HITL)
*   **Interface:** `Command Center > Pending Replies`
*   **Operator Actions:**
    *   **Approve:** Send the AI-drafted response.
    *   **Edit:** Modify the draft, then send.
    *   **Reject/Reclassify:** Correct the Intent Category (Feedback Loop for Training).

## 5. Tracker & Metrics
A tracker must be maintained (`Reply_Tracker_Table`) capturing:
*   `LeadID`
*   `EmailID`
*   `ReceivedTimestamp`
*   `AI_Classification`
*   `AI_Confidence`
*   `Human_Correction` (if any)
*   `Response_Time`
*   `Outcome` (Meeting Booked, Lost, Unsubscribed)
