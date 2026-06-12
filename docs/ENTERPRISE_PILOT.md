# Enterprise Pilot Onboarding Guide

## Overview
This guide walks through onboarding a new enterprise customer onto CraftMyFunnel in **ENTERPRISE_CORE** mode with full governance, compliance, and audit capabilities.

## Prerequisites
- Admin access to CraftMyFunnel platform
- Customer's organization details
- SSO configuration (if required)
- List of initial users and their roles

## Onboarding Steps

### 1. Create Pilot Organization

Run the automated setup script:

```bash
npx tsx src/scripts/setup-enterprise-pilot.ts \
  "Customer Name" \
  "admin@customer.com" \
  "Admin Name" \
  true \
  200
```

**Parameters:**
- Org name
- Admin email
- Admin name  
- Enable SSO (true/false)
- Max daily actions (default: 200)

This creates:
- ✓ Organization with ENTERPRISE_CORE mode
- ✓ Default policies and guardrails
- ✓ Feature flags (EXPERIMENTAL disabled)
- ✓ Admin user with ORG_ADMIN role
- ✓ SSO configuration (if enabled)

### 2. Configure SSO (Optional)

If SSO is required:

1. Navigate to `/admin/teams/{teamId}/sso`
2. Upload IdP metadata or configure OIDC
3. Test SSO login flow
4. Enable enforcement (disables password login)

### 3. Set Organizational Policies

Review and adjust policies in `/admin/teams/{teamId}/policy`:

- **Product Mode**: ENTERPRISE_CORE (locked)
- **Max Daily Actions**: Adjust based on customer size
- **Approval Requirements**: Enable for campaigns
- **PII Detection**: Always enabled
- **Blocked Keywords**: Add industry-specific compliance terms

### 4. Assign User Roles

Create users with appropriate roles:

| Role | Use Case | Permissions |
|------|----------|-------------|
| `SYSTEM_ADMIN` | Platform administrators | Full system access |
| `ORG_ADMIN` | Customer admins | Org-level configuration |
| `SALES_MANAGER` | Team leads | Approve campaigns, manage team |
| `SALES_USER` | Sales reps | Create campaigns, manage leads |
| `CALLER` | Call center staff | Access caller queue only |
| `COMPLIANCE_OFFICER` | Compliance team | Audit logs, consent records |

### 5. Import Initial Leads

**CRITICAL:** All leads must have consent flags set.

Required fields:
- `email` or `phone`
- `consentObtained: true` (for DPDP Act compliance)
- `whatsappConsent: true/false`
- `whatsappConsentAt` (if WhatsApp enabled)
- `whatsappConsentBy` (user who recorded consent)

Use bulk import API with validation:
```
POST /api/leads/import
```

### 6. Configure Feature Access

Review feature flags for the org:

**Enabled by Default (CORE layer):**
- ✓ AI Email Generation
- ✓ WhatsApp Messaging (with consent)
- ✓ Caller Queue
- ✓ Audit Logs
- ✓ Approval Workflows

**Disabled by Default (EXPERIMENTAL):**
- ✗ LinkedIn Automation
- ✗ Web Scraping
- ✗ Unregulated AI features

Enable GOVERNED_AI features only after explicit approval.

### 7. User Training

**Sales Users:**
- Campaign creation with approval workflow
- Lead management with consent tracking
- Understanding ENTERPRISE_CORE restrictions

**Callers:**
- Using `/caller` queue interface
- Recording call outcomes
- State transition rules

**Admins:**
- Reviewing approval requests
- Monitoring audit logs
- Managing user quotas

### 8. Validation Checklist

Before going live, verify:

- [ ] All users can log in (SSO or password)
- [ ] EXPERIMENTAL features are disabled
- [ ] Campaign approval workflow works
- [ ] Audit logs are recording actions
- [ ] WhatsApp consent enforcement works
- [ ] Caller queue is accessible to CALLER role
- [ ] PII detection blocks cloud-bound requests
- [ ] Guardrails are enforcing blocked keywords

### 9. Go-Live

1. Enable the organization in production
2. Monitor audit logs for first 48 hours
3. Review approval queue daily
4. Collect user feedback
5. Adjust policies as needed

## Post-Launch Support

### Monitoring

Track key metrics:
- Daily active users
- Approval request volume
- Audit log anomalies
- Consent opt-out rates
- Guardrail violation rates

### Escalation

For compliance issues:
1. Check audit logs: `/admin/teams/{teamId}/audit`
2. Review user actions
3. Contact compliance officer
4. Suspend user access if needed

## Common Issues

### "Feature not available"
→ Check ProductMode is ENTERPRISE_CORE  
→ Verify feature flag is enabled  
→ Ensure user has correct role

### "Consent required"
→ Lead is missing consent flag  
→ Re-import with proper consent data  
→ Use ConsentService to record consent

### "Approval required"
→ Feature requires SALES_MANAGER approval  
→ Check approval queue: `/approvals`  
→ Manager should review and approve

## Support Contacts

- Technical: support@craftmyfunnel.com
- Compliance: compliance@craftmyfunnel.com
- Emergency: [On-call number]
