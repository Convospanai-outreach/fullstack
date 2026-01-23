# SOC 2 Type II Control Mappings

## Overview
This document maps ConvoSpan's technical controls to SOC 2 Trust Services Criteria, demonstrating readiness for SOC 2 Type II certification.

## Trust Services Criteria Coverage

### CC1: Control Environment

#### CC1.1: Organization demonstrates commitment to integrity and ethical values
**Implementation:**
- Code of conduct for AI usage (no manipulation, no spam)
- Guardrail policies enforcing ethical keywords blocking
- Approval workflows for sensitive campaigns

**Evidence:**
- `GuardrailPolicy` model with blocklist/allowlist
- `ApprovalRequest` workflow for campaign launches
- Audit logs tracking all AI-generated content

#### CC1.2: Board exercises oversight
**Implementation:**
- ORG_ADMIN and SYSTEM_ADMIN roles with full visibility
- Real-time audit log access
- Approval request dashboard

**Evidence:**
- UserRole enum with admin hierarchy
- `/admin/audit` and `/admin/approvals` UIs
- ImmutableAudit trail

---

### CC2: Communication and Information

#### CC2.1: Obtains or generates relevant quality information
**Implementation:**
- RAG-powered knowledge retrieval
- Grounding evaluation to prevent hallucinations
- Event-sourced learning loop

**Evidence:**
- `RAGService` with vector search
- `GroundingEvaluator` validation
- `SystemEvent` model for data capture

---

### CC3: Risk Assessment

#### CC3.1: Specifies objectives with sufficient clarity
**Implementation:**
- Product mode tiers (ENTERPRISE_CORE = high governance)
- Feature flag layer (EXPERIMENTAL flagged explicitly)
- Organizational policies define risk tolerance

**Evidence:**
- `ProductMode` enum
- `CapabilityLayer` for feature classification
- `OrganizationPolicy` with configurable limits

---

### CC4: Monitoring Activities

#### CC4.1: Establishes and operates monitoring activities
**Implementation:**
- Continuous audit logging (all CRUD operations)
- Guardrail violation logs
- LLM usage tracking for anomaly detection

**Evidence:**
- `AuditLog` with immutable hash chain
- `GuardrailLog` for policy violations
- `LLMUsageLog` for cost/performance monitoring

---

### CC5: Control Activities

#### CC5.1: Selects and develops control activities
**Implementation:**
- RBAC enforced at API and UI layers
- Middleware-based route protection
- State machine for conversation integrity

**Evidence:**
- `middleware.ts` with JWT + role checks
- `ConversationService` with strict state transitions
- Permission helpers in `permissions.ts`

---

### CC6: Logical and Physical Access

#### CC6.1: Restricts logical access
**Implementation:**
- JWT-based authentication
- Role-based authorization (6 distinct roles)
- SSO support for enterprise customers

**Evidence:**
- NextAuth integration with `enterpriseRole`
- `SsoConfiguration` model for SAML/OIDC
- Middleware enforcing role-based routes

#### CC6.2: Restricts physical access
**Implementation:**
- On-prem edge node with hardware signature verification
- Data sovereignty via hybrid AI routing

**Evidence:**
- `EdgeNode` model with `hardwareId` binding
- `HybridRouter` enforcing PII stays on-prem
- `HARDWARE_SIGNATURE` environment variable

---

### CC7: System Operations

#### CC7.1: Manages system changes
**Implementation:**
- Audit log for all schema/policy changes
- Feature flag toggles (no code deploys for feature changes)
- Approval required for GOVERNED_AI features

**Evidence:**
- `FeatureFlag` with layer-based restrictions
- `ApprovalRequest` for feature activation
- Immutable audit trail

---

### CC8: Change Management

#### CC8.1: Authorizes changes
**Implementation:**
- ORG_ADMIN approval for organizational policy changes
- SALES_MANAGER approval for campaign launches
- System-wide feature flags require SYSTEM_ADMIN

**Evidence:**
- `ApprovalRequest` workflow
- Role-based permissions matrix
- Audit logs for all config changes

---

## Additional Security Controls

### A1: Confidentiality

#### A1.1: Protects confidential information
**Implementation:**
- PII detection prevents cloud transmission
- End-to-end encryption for sensitive data
- WhatsApp consent enforcement

**Evidence:**
- `HybridRouter.validateCloudSafety()` PII detection
- `ConsentService` with DPDP Act compliance
- Encrypted fields in database (via Prisma + PostgreSQL)

---

## Compliance Readiness Summary

| Control Category | Coverage | Status |
|-----------------|----------|--------|
| CC1: Control Environment | ✓ Complete | Ready |
| CC2: Communication | ✓ Complete | Ready |
| CC3: Risk Assessment | ✓ Complete | Ready |
| CC4: Monitoring | ✓ Complete | Ready |
| CC5: Control Activities | ✓ Complete | Ready |
| CC6: Access Controls | ✓ Complete | Ready |
| CC7: System Operations | ✓ Complete | Ready |
| CC8: Change Management | ✓ Complete | Ready |
| A1: Confidentiality | ✓ Complete | Ready |

---

## Auditor Notes

**Audit Evidence Locations:**
- Database: All models with `@@index` for query optimization
- Code: `/src/modules/audit/`, `/src/lib/permissions.ts`
- Logs: `AuditLog`, `GuardrailLog`, `ImmutableAudit` tables
- Policies: `OrganizationPolicy`, `GuardrailPolicy`, `FeatureFlag`

**Recommended Next Steps:**
1. Engage SOC 2 auditor
2. Demonstrate audit log immutability (hash chain verification)
3. Prove role segregation with test users
4. Show approval workflow end-to-end
5. Validate PII detection with sample data
