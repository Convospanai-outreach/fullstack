# CraftMyFunnel Unified Data Model Specification

## Purpose

The CraftMyFunnel Unified Data Model defines how all platform components store and exchange data.

This model ensures interoperability between:

* CraftMyFunnel Intel (signal intelligence)
* SaaS Control Platform (campaign orchestration)
* Edge Nodes (execution and sovereignty layer)

The schema prioritizes data isolation, signal enrichment, and safe handling of personally identifiable information (PII).

---

# Core Entities

## Organization

Represents a customer account using the CraftMyFunnel platform.

Attributes:

```text
organization_id
name
subscription_plan
billing_status
created_at
```

Relationships:

```text
organization → owns → campaigns
organization → owns → leads
organization → owns → signals
```

---

## User

Represents team members within an organization.

Attributes:

```text
user_id
organization_id
email
role
created_at
```

Roles may include:

```text
admin
operator
analyst
viewer
```

---

## Company

Represents organizations discovered via scraping or enrichment.

Attributes:

```text
company_id
domain
company_name
industry
country
employee_count
technology_stack
created_at
```

Relationships:

```text
company → employs → person
company → triggers → signals
```

---

## Person

Represents individuals associated with companies.

Attributes:

```text
person_id
company_id
name
title
department
seniority
linkedin_url
email_token
phone_token
created_at
```

Note:

PII is tokenized. Actual identifiers are stored in the Edge Node vault.

Example:

```text
EMAIL_1
PHONE_1
PERSON_1
```

---

# Signal Intelligence

Signals represent detected business changes.

## Signal

Attributes:

```text
signal_id
company_id
signal_type
signal_strength
confidence_score
timestamp
source_url
```

Possible signal types:

```text
hiring_expansion
facility_expansion
technology_adoption
funding_event
operational_friction
```

---

## Intent Score

Each company receives a calculated intent score.

Attributes:

```text
company_id
intent_score
calculated_at
```

Score range:

```text
0 – 100
```

Intent scores determine campaign eligibility.

---

# Campaign System

## Campaign

Attributes:

```text
campaign_id
organization_id
campaign_name
target_industry
target_role
status
created_at
```

Campaign statuses:

```text
draft
active
paused
completed
```

---

## Campaign Sequence

Represents the DAG workflow.

Attributes:

```text
sequence_id
campaign_id
node_type
node_config
next_nodes
```

Example node types:

```text
linkedin_visit
linkedin_connect
linkedin_message
delay
condition
```

---

# Lead Management

## Lead

Represents a person targeted by campaigns.

Attributes:

```text
lead_id
person_id
campaign_id
lead_status
qualification_score
created_at
```

Lead statuses:

```text
new
contacted
connected
replied
converted
not_interested
```

---

# Automation Tasks

Tasks are dispatched to Edge Nodes.

## Task

Attributes:

```text
task_id
campaign_id
lead_id
action
payload
status
created_at
```

Actions include:

```text
linkedin_visit
linkedin_connect
linkedin_message
linkedin_followup
```

Statuses:

```text
pending
assigned
executing
completed
failed
```

---

# Edge Node System

## Edge Node

Represents a physical execution device.

Attributes:

```text
node_id
hardware_signature
team_id
region
status
last_heartbeat
```

Statuses:

```text
online
offline
degraded
```

---

## Node Task Execution

Tracks task results.

Attributes:

```text
execution_id
task_id
node_id
status
execution_time
result_data
```

---

# Conversation Data

## Message

Stores outreach messages.

Attributes:

```text
message_id
lead_id
channel
content
sent_at
```

Channels:

```text
linkedin
email
whatsapp
```

---

## Reply

Represents responses from prospects.

Attributes:

```text
reply_id
message_id
lead_id
content
intent_classification
received_at
```

Intent categories:

```text
positive
curious
needs_info
not_interested
unsubscribe
```

---

# Meeting System

## Meeting

Represents scheduled meetings.

Attributes:

```text
meeting_id
lead_id
scheduled_time
meeting_link
calendar_provider
status
```

Statuses:

```text
scheduled
completed
cancelled
```

---

# Edge Node Vault

Sensitive data is stored locally.

## PII Vault Entry

Attributes:

```text
token_id
original_value
entity_type
created_at
```

Entity types:

```text
person
email
phone
```

The SaaS platform never receives raw identifiers.

---

# Event Logging

All system actions are logged.

## System Event

Attributes:

```text
event_id
event_type
entity_id
timestamp
metadata
```

Examples:

```text
signal_detected
task_dispatched
task_completed
reply_received
meeting_scheduled
```

---

# Data Flow

Typical data lifecycle:

```text
Intel engine discovers signal
→ signal stored
→ intent score updated
→ lead qualifies
→ campaign generates tasks
→ edge node executes actions
→ replies processed
→ meeting scheduled
```

---

# Data Isolation

The platform enforces strict multi-tenant separation.

Rules:

```text
organization_id filters all queries
signals are namespace isolated
edge vaults are device-local
```

---

# Future Extensions

Future data models may include:

```text
buyer_committee
technology_graph
account_health
intent_prediction
```

These models will enhance signal-driven outreach intelligence.
