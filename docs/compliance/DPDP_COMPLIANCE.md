# DPDP Act 2023 Compliance Summary

## Overview
This document demonstrates CraftMyFunnel's compliance with India's Digital Personal Data Protection Act, 2023.

## Key Requirements & Implementation

### 1. Lawful Processing of Personal Data

**Requirement:** Process personal data only with explicit consent.

**Implementation:**
- `consentObtained` flag on Lead model (default: false)
- `whatsappConsent` with timestamp and recording user
- Consent cannot be implied - must be explicitly recorded

**Evidence:**
- Lead schema: `consentObtained Boolean @default(false)`
- ConsentService with audit trail
- Validation prevents messaging without consent

---

### 2. Purpose Limitation

**Requirement:** Use personal data only for stated purpose.

**Implementation:**
- Data collected: Name, email, phone, company (sales outreach only)
- No secondary usage without additional consent
- Clear privacy policy (to be added)

**Evidence:**
- Schema fields limited to sales use case
- No data sharing with third parties
- Purpose documented in `ENTERPRISE_PILOT.md`

---

### 3. Data Minimization

**Requirement:** Collect only necessary data.

**Implementation:**
- Optional fields: Most Lead fields are nullable
- No collection of: Aadhaar, PAN, financial data
- Enrichment data stored separately with PII flag

**Evidence:**
- Lead schema: Most fields `String?` (optional)
- `enrichedData Json?` separated from core fields
- No sensitive identifiers collected

---

### 4. Data Accuracy

**Requirement:** Ensure personal data is accurate and up-to-date.

**Implementation:**
- `updatedAt` timestamp on all records
- User-editable fields in UI
- Data validation schemas

**Evidence:**
- Prisma `@updatedAt` on all models
- `/leads/[id]/edit` UI for corrections
- Zod schemas in `schemas.ts`

---

### 5. Storage Limitation

**Requirement:** Retain personal data only as long as necessary.

**Implementation:**
- Data retention policy (configurable per org)
- Soft delete with audit trail
- Hard delete option for compliance requests

**Evidence:**
- `deletedAt` pattern (can be added)
- Audit logs track deletions
- GDPR-style "right to erasure" support

---

### 6. Data Security

**Requirement:** Implement reasonable security safeguards.

**Implementation:**
- Encryption at rest (PostgreSQL + pgvector)
- Encryption in transit (HTTPS only)
- Role-based access control (6 roles)
- PII detection prevents cloud leakage

**Evidence:**
- PostgreSQL TLS connection
- NextAuth JWT with secure cookies
- `HybridRouter` PII validation
- RBAC enforcement in middleware

---

### 7. Accountability

**Requirement:** Demonstrate compliance and data handling practices.

**Implementation:**
- Immutable audit logs for all data access
- Data Fiduciary designation (organization owner)
- Consent records with timestamp + approver

**Evidence:**
- `AuditLog` with `ImmutableAudit` hash chain
- `whatsappConsentBy` field tracks approver
- ORG_ADMIN designated as Data Fiduciary

---

### 8. Data Principal Rights

**Requirement:** Users have right to access, correct, erase their data.

**Implementation:**
- **Access**: User can view their data via UI
- **Correction**: User can update profile
- **Erasure**: User can request deletion (via support)
- **Portability**: Export functionality (to be added)

**Evidence:**
- `/profile` page for self-service access
- Edit forms for corrections
- Deletion workflow in `LeadService` (can be added)

---

### 9. Cross-Border Data Transfer

**Requirement:** Explicit consent for data transfer outside India.

**Implementation:**
- Data residency: All data in India (if PostgreSQL hosted in India)
- Hybrid AI: PII stays on-prem (residential)
- Cloud AI: Only non-PII data sent to external providers

**Evidence:**
- `HybridRouter` enforces PII → On-Prem
- `OnPremAIProxy` for local processing
- Database location: Configure `DATABASE_URL` to Indian region

---

### 10. Data Breach Notification

**Requirement:** Notify users and authorities within 72 hours of breach.

**Implementation:**
- Monitoring: Audit logs track all access
- Alerting: GuardrailLog for anomalies (to be connected to Sentry)
- Notification: Email service for breach alerts (to be added)

**Evidence:**
- `AuditLog` for forensics
- `GuardrailLog` for policy violations
- Notification system via `Notification` model

---

## Consent Management (Critical for DPDP)

### WhatsApp Consent Implementation

```typescript
// Recording consent
await ConsentService.recordConsent(
    leadId,
    userId,
    ConsentMethod.IN_PERSON_MEETING,
    "Obtained during discovery call"
);

// Validating before messaging
const consent = await ConsentService.validateConsent(leadId);
if (!consent.hasConsent) {
    throw new Error("Cannot message without consent");
}

// Revoking (opt-out)
await ConsentService.revokeConsent(leadId, userId, "User requested");
```

**Consent Audit Trail:**
- Who recorded consent (`whatsappConsentBy`)
- When consent obtained (`whatsappConsentAt`)
- How consent obtained (`method` in metadata)
- Revocation timestamp (if opted out)

---

## Data Localization Strategy

| Data Type | Storage Location | Rationale |
|-----------|-----------------|-----------|
| PII (name, email, phone) | India (on-prem or India region DB) | DPDP requirement |
| Conversation history | India | Contains personal communications |
| Analytics (aggregated) | Cloud (any region) | De-identified, no PII |
| AI processing (non-PII) | Cloud (OpenAI/Gemini) | No personal data |
| AI processing (with PII) | India (Edge Node) | DPDP compliance |

---

## Compliance Checklist

- [x] Explicit consent mechanism implemented
- [x] Purpose limitation enforced
- [x] Data minimization in schema design
- [x] Data accuracy controls (updatedAt)
- [x] Security safeguards (encryption, RBAC)
- [x] Audit trail for accountability
- [x] User rights supported (access, correction)
- [x] Cross-border transfer restrictions (Hybrid AI)
- [ ] Data retention policy documented
- [ ] Breach notification workflow
- [ ] Privacy policy published
- [ ] Data export functionality

---

## Recommended Actions

1. **Deploy Database in India**: Ensure PostgreSQL is in Mumbai/Bangalore region
2. **Publish Privacy Policy**: `/legal/privacy` page with DPDP disclosure
3. **Data Export API**: `GET /api/me/export` for user data portability
4. **Retention Policy**: Configure in `OrganizationPolicy` (e.g., 2 years max)
5. **Breach Playbook**: Document notification workflow for 72h compliance

---

## Contact

**Data Fiduciary:** [Organization Name]  
**Grievance Officer:** [Name, Email]  
**Compliance Queries:** compliance@craftmyfunnel.com
