# ConvoSpan Agent Architecture

## Overview

ConvoSpan operates as a distributed multi-agent system composed of intelligence agents, orchestration agents, and execution agents.

The platform is divided into three layers:

1. **Intel Layer (NetJana)**
   Signal discovery and intelligence extraction.

2. **Control Layer (SaaS Platform)**
   Campaign orchestration and AI conversation management.

3. **Execution Layer (Edge Node)**
   Physical automation and sovereign data protection.

Each layer contains specialized agents that collaborate through queues and event streams.

---

# Layer 1: Intelligence Agents (ConvoSpan Intel)

These agents operate inside the NetJana intelligence engine.

Their role is to discover and analyze external signals that indicate potential business opportunities.

---

## Signal Discovery Agent

Purpose:
Detect new company signals from scraped data.

Input:

* scraped page content
* company metadata
* news sections
* career pages

Detectable signals:

* hiring surge
* infrastructure expansion
* technology adoption
* funding announcement
* operational friction

Output:

```
{
 signal_type,
 company,
 signal_strength,
 signal_timestamp
}
```

---

## Pain Point Analyst Agent

Purpose:
Convert detected signals into actionable outreach insights.

Example:

Signal

```
Hiring expansion
```

Pain hypothesis

```
Rapid hiring may indicate scaling infrastructure challenges.
```

Output:

```
{
 company,
 pain_points,
 outreach_angles
}
```

---

## Lead Qualification Agent

Purpose:
Score prospects against Ideal Customer Profile (ICP).

Scoring criteria:

* job seniority
* company size
* industry alignment
* signal presence

Output:

```
{
 lead_id,
 score,
 qualification_reason
}
```

---

# Layer 2: SaaS Orchestration Agents

These agents manage campaigns and conversations.

---

## Campaign Planner Agent

Purpose:

Create outreach sequences based on signals and ICP.

Example sequence:

Day 1: profile visit
Day 2: connection request
Day 4: message
Day 7: follow-up

Output:

```
campaign_workflow
```

represented as DAG.

---

## Message Composer Agent

Purpose:

Generate LinkedIn messages using contextual data.

Inputs:

* lead context
* company signals
* industry data
* previous conversation history

Rules:

* no sales tone
* peer-to-peer communication
* max 350 characters

Output:

```
message_text
```

---

## Reply Intelligence Agent

Purpose:

Classify incoming messages.

Categories:

* POSITIVE
* CURIOUS
* NEED_INFO
* NOT_INTERESTED
* OUT_OF_OFFICE

Output:

```
{
 intent,
 confidence,
 next_action
}
```

---

## Meeting Conversion Agent

Purpose:

Convert positive conversations into meetings.

Steps:

1. detect intent
2. propose meeting
3. generate calendar link

Output:

```
meeting_invite
```

---

## Safety Sentinel Agent

Purpose:

Prevent risky automation behavior.

Checks:

* repetitive messages
* excessive activity
* LinkedIn limits

If risk detected:

* reduce activity
* pause campaign

---

# Layer 3: Edge Execution Agents

These agents run on physical Edge Nodes.

They execute automation tasks in a real browser environment.

---

## Edge Task Executor

Purpose:

Execute automation commands sent by SaaS.

Supported actions:

* visit_profile
* send_connection
* send_message
* follow_up
* check_connection

Execution flow:

```
receive task
open browser session
execute action
return result
```

---

## Behavior Simulation Agent

Purpose:

Simulate natural user activity.

Actions:

* scroll feed
* open profile
* like post
* idle pause
* campaign action

Rules:

* campaign actions ≤ 60% of session
* random delays
* session duration 10–30 minutes

---

## PII Firewall Agent

Purpose:

Protect sensitive information before sending data to cloud AI systems.

Detectable PII:

* names
* email addresses
* phone numbers
* company contact info

Process:

```
detect PII
replace with token
store mapping in local vault
```

Example:

```
Rahul Sharma → PERSON_1
```

---

## Hardware Identity Agent

Purpose:

Authenticate the edge node with the SaaS platform.

Mechanism:

* hardware_signature
* HMAC request signing

Unauthorized nodes are rejected.

---

# Agent Communication Model

Agents communicate using event-driven architecture.

```
Intel Agents
      ↓
SaaS Agents
      ↓
Edge Agents
```

Events include:

```
signal_detected
lead_scored
campaign_started
task_dispatched
task_completed
reply_received
meeting_scheduled
```

---

# Agent Memory Model

Agents share knowledge through three memory layers:

1. **Lead Memory**
   Lead-specific context and interaction history.

2. **Campaign Memory**
   Campaign-level performance insights.

3. **Organization Memory**
   Company-specific messaging style and learning.

---

# Safety Principles

All agents must follow these rules:

1. Avoid robotic behavior patterns.
2. Messages must vary structurally.
3. Outreach should resemble peer-to-peer conversations.
4. Automation limits must mimic human usage.

---

# System Event Flow

Typical lifecycle:

```
Intel discovers signal
→ Lead Qualification Agent scores lead
→ Campaign Planner creates sequence
→ SaaS dispatches tasks
→ Edge Node executes automation
→ Reply Intelligence analyzes response
→ Meeting Conversion Agent schedules call
```

---

# Future Agents

Planned additions:

* Intent Prediction Agent
* Buyer Committee Graph Agent
* Account Health Monitor
* Signal Graph Builder

These will extend ConvoSpan into a full autonomous sales intelligence platform.
