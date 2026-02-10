# AI Agentic Automation System - Quick Start Guide

**Version:** 1.0  
**Date:** February 10, 2026  
**For:** Development Team

---

## 📋 Overview

This guide provides a quick reference for implementing the AI Agentic Automation System. The system transforms ConvoSpan into a comprehensive, multi-channel outreach platform with intelligent automation.

---

## 🎯 What We're Building

### Core Features
1. **Drip Campaigns** - Multi-step, condition-based email sequences
2. **Unified Inbox** - Centralized view of all prospect communications
3. **Deliverability Suite** - Email verification, warmup, and rotation
4. **LinkedIn Automation** - Automated connection requests and messaging
5. **Reply Intelligence** - AI-powered reply classification and routing
6. **Multi-Channel Orchestration** - Email, LinkedIn, WhatsApp, Phone

### What's Already Done ✅
- Reply Analyzer Agent (`src/lib/ai/agents/ReplyAnalyzerAgent.ts`)
- Reply Tracker Database Schema (`prisma/schema.prisma`)
- SendPulse Integration (`src/integrations/sendpulse.ts`)
- WhatsApp Mock Service (`src/services/WhatsAppService.ts`)
- Rate Limiting with Redis (`src/lib/rateLimit.ts`)
- Structured Logging (`src/lib/logger.ts`)

---

## 🚀 Getting Started

### Prerequisites
```bash
# Required API Keys (add to .env)
HUNTER_API_KEY=your_hunter_key          # Email verification
ZEROBOUNCE_API_KEY=your_zerobounce_key  # Backup email verification
TWILIO_ACCOUNT_SID=your_twilio_sid      # WhatsApp/SMS
TWILIO_AUTH_TOKEN=your_twilio_token
LINKEDIN_SESSION_COOKIE=your_li_at      # LinkedIn automation
```

### Installation Steps

#### 1. Update Database Schema
```bash
# Copy new models from docs/DATABASE_SCHEMA_EXTENSIONS.md
# Append to prisma/schema.prisma

# Generate Prisma Client
npx prisma generate

# Create migration
npx prisma migrate dev --name add_agentic_features

# Verify migration
npx prisma studio
```

#### 2. Install Dependencies
```bash
# Add new packages
npm install puppeteer nodemailer dns

# For LinkedIn automation
npm install puppeteer-extra puppeteer-extra-plugin-stealth
```

#### 3. Create Directory Structure
```bash
# Create new module directories
mkdir -p src/modules/drip-campaigns
mkdir -p src/modules/deliverability
mkdir -p src/modules/linkedin
mkdir -p src/modules/inbox

# Create worker directory
mkdir -p src/workers
```

---

## 📁 File Structure

```
src/
├── lib/
│   └── ai/
│       └── agents/
│           ├── ReplyAnalyzerAgent.ts ✅ (Done)
│           ├── SequenceGeneratorAgent.ts (TODO)
│           ├── WarmupAgent.ts (TODO)
│           └── SubjectLineOptimizer.ts (TODO)
│
├── modules/
│   ├── drip-campaigns/
│   │   ├── DripEngine.ts (TODO - Priority 1)
│   │   └── DripScheduler.ts (TODO - Priority 1)
│   │
│   ├── deliverability/
│   │   ├── EmailVerifier.ts (TODO - Priority 1)
│   │   ├── InboxRotation.ts (TODO - Priority 1)
│   │   └── WarmupService.ts (TODO - Priority 2)
│   │
│   ├── linkedin/
│   │   ├── LinkedInAutomation.ts (TODO - Priority 2)
│   │   └── EmailFinder.ts (TODO - Priority 2)
│   │
│   └── inbox/
│       ├── UnifiedInboxService.ts (TODO - Priority 2)
│       └── MessageSync.ts (TODO - Priority 2)
│
├── app/
│   ├── api/
│   │   ├── drip-campaigns/ (TODO)
│   │   ├── inbox/ (TODO)
│   │   ├── replies/
│   │   │   └── review/
│   │   │       └── route.ts (TODO - Priority 1)
│   │   └── webhooks/
│   │       └── sendpulse/
│   │           └── route.ts ✅ (Done)
│   │
│   └── (dashboard)/
│       ├── campaigns/
│       │   └── drip/
│       │       └── page.tsx (TODO - Priority 1)
│       ├── inbox/
│       │   └── page.tsx (TODO - Priority 2)
│       └── command-center/
│           └── replies/
│               └── page.tsx (TODO - Priority 1)
│
└── workers/
    ├── dripScheduler.ts (TODO - Priority 1)
    └── warmupScheduler.ts (TODO - Priority 2)
```

---

## 🔧 Implementation Priority

### Sprint 1 (Weeks 1-2) - Foundation
**Goal:** Get core drip campaigns working

#### Week 1: Backend
```bash
# Day 1-2: Database & Core Logic
1. Add DripCampaign models to schema ✓
2. Implement DripEngine.enrollLead()
3. Implement DripEngine.executeStep()

# Day 3-4: Scheduler Integration
4. Create dripScheduler.ts worker
5. Test end-to-end enrollment → execution

# Day 5: Email Verification
6. Implement EmailVerifier.ts
7. Add bulk verification endpoint
```

#### Week 2: Frontend
```bash
# Day 1-3: Campaign Builder
1. Create drip campaign builder UI
2. Implement step editor component
3. Add preview functionality

# Day 4-5: Reply Dashboard
4. Build reply review dashboard
5. Add HITL approval workflow
6. Test reply analyzer integration
```

### Sprint 2 (Weeks 3-4) - Multichannel
**Goal:** Add LinkedIn and WhatsApp

#### Week 3: LinkedIn
```bash
1. Implement LinkedInAutomation.ts
2. Add connection request logic
3. Implement message sending
4. Build LinkedIn campaign UI
```

#### Week 4: Unified Inbox
```bash
1. Create UnifiedMessage sync service
2. Build inbox UI
3. Add real-time updates
4. Test multi-channel flow
```

### Sprint 3 (Weeks 5-6) - AI Enhancement
**Goal:** Advanced AI features

```bash
1. Sequence Generator Agent
2. Subject Line Optimizer
3. Advanced Analytics Dashboard
4. Sentiment Analysis
```

---

## 🧪 Testing Strategy

### Unit Tests
```typescript
// Example: DripEngine.test.ts
describe('DripEngine', () => {
  it('should enroll lead in campaign', async () => {
    const result = await DripEngine.enrollLead(campaignId, leadId);
    expect(result.status).toBe('ACTIVE');
  });
  
  it('should skip step if lead replied', async () => {
    // Create mock reply
    await prisma.replyTracker.create({...});
    
    const shouldSkip = await DripEngine.shouldSkipStep(step, lead);
    expect(shouldSkip).toBe(true);
  });
});
```

### Integration Tests
```typescript
// Example: drip-campaign.integration.test.ts
describe('Drip Campaign E2E', () => {
  it('should execute full 3-step sequence', async () => {
    // 1. Create campaign
    const campaign = await createTestCampaign();
    
    // 2. Enroll lead
    await DripEngine.enrollLead(campaign.id, lead.id);
    
    // 3. Fast-forward time and execute steps
    await executeScheduledJobs();
    
    // 4. Verify emails sent
    const emails = await prisma.email.findMany({...});
    expect(emails).toHaveLength(3);
  });
});
```

### Manual Testing Checklist
- [ ] Create drip campaign with 3 steps
- [ ] Enroll test lead
- [ ] Verify first email sent immediately
- [ ] Verify second email sent after delay
- [ ] Reply to email
- [ ] Verify campaign paused for that lead
- [ ] Check reply appears in dashboard
- [ ] Approve/reject reply in HITL interface

---

## 🐛 Common Issues & Solutions

### Issue: Prisma Client Not Updated
```bash
# Solution
npx prisma generate
npm run build
```

### Issue: LinkedIn Automation Fails
```bash
# Check cookie validity
# LinkedIn cookies expire every 30 days
# Update in Settings > Integrations
```

### Issue: Email Deliverability Low
```bash
# 1. Check warmup status
# 2. Verify SPF/DKIM records
# 3. Run spam test
# 4. Check inbox rotation is working
```

### Issue: Drip Campaign Not Executing
```bash
# Check scheduler is running
npm run worker

# Check job queue
npx prisma studio
# Navigate to Job table, filter by type: DRIP_STEP_EXECUTION
```

---

## 📊 Monitoring & Observability

### Key Metrics to Track
```typescript
// Dashboard metrics
const metrics = {
  // Drip Campaigns
  activeCampaigns: await prisma.dripCampaign.count({ where: { isActive: true } }),
  enrolledLeads: await prisma.dripEnrollment.count({ where: { status: 'ACTIVE' } }),
  
  // Deliverability
  avgDeliverabilityScore: await getAvgScore(),
  inboxesWarming: await prisma.teamInbox.count({ where: { isWarmingUp: true } }),
  
  // Engagement
  replyRate: totalReplies / totalSent,
  meetingRate: totalMeetings / totalSent,
  
  // AI Performance
  aiAccuracy: correctClassifications / totalClassifications,
  hitlOverrideRate: humanCorrections / totalClassifications
};
```

### Logging Best Practices
```typescript
// Use structured logging
logger.info('[DripEngine] Executing step', {
  enrollmentId,
  stepNumber,
  channel,
  leadId
});

// Log errors with context
logger.error('[DripEngine] Step execution failed', {
  error: error.message,
  stack: error.stack,
  enrollmentId,
  stepNumber
});
```

---

## 🔐 Security Considerations

### API Key Management
```bash
# Never commit API keys
# Use environment variables
# Rotate keys quarterly
# Use different keys for dev/staging/prod
```

### LinkedIn Automation
```bash
# Rate limiting is critical
# Max 100 connection requests/day
# Max 50 messages/day
# Randomize delays between actions
```

### Data Privacy
```bash
# PII must be masked before sending to cloud AI
# Use SovereignFirewall for compliance
# Log all data access for audit
```

---

## 📚 Additional Resources

### Documentation
- [Full Architecture](./ARCHITECTURE_AI_AGENTIC_SYSTEM.md)
- [Implementation Tracker](./IMPLEMENTATION_TRACKER.md)
- [Database Schema](./DATABASE_SCHEMA_EXTENSIONS.md)
- [Reply Decision Tree SOP](./SOP_REPLY_DECISION_TREE.md)

### External APIs
- [Hunter.io Docs](https://hunter.io/api-documentation)
- [SendPulse API](https://sendpulse.com/integrations/api)
- [Twilio WhatsApp](https://www.twilio.com/docs/whatsapp)
- [LinkedIn API](https://docs.microsoft.com/en-us/linkedin/)

### Code Examples
```typescript
// Example: Creating a drip campaign
const campaign = await prisma.dripCampaign.create({
  data: {
    name: "SaaS Outreach Sequence",
    teamId: team.id,
    triggerType: "MANUAL",
    isActive: true,
    steps: {
      create: [
        {
          stepNumber: 1,
          channel: "EMAIL",
          subject: "Quick question about {{company}}",
          body: "Hi {{firstName}}, ...",
          delayDays: 0
        },
        {
          stepNumber: 2,
          channel: "EMAIL",
          subject: "Following up",
          body: "Just checking if you saw my last email...",
          delayDays: 3,
          skipConditions: { replied: true }
        }
      ]
    }
  }
});

// Example: Enrolling a lead
await DripEngine.enrollLead(campaign.id, lead.id);
```

---

## 🎓 Training Resources

### For Developers
1. Read architecture document (30 min)
2. Review existing ReplyAnalyzerAgent code (15 min)
3. Set up local environment (1 hour)
4. Complete first task from Sprint 1 (4-8 hours)

### For QA
1. Review SOP_REPLY_DECISION_TREE.md
2. Set up test accounts (LinkedIn, email)
3. Create test scenarios spreadsheet
4. Execute manual testing checklist

---

## 🤝 Support & Questions

### Team Contacts
- **Architecture Questions:** Lead Engineer
- **Database Issues:** Backend Team
- **UI/UX Feedback:** Frontend Team
- **API Integration:** DevOps Team

### Daily Standup Topics
- Blockers (API keys, dependencies)
- Progress on current sprint tasks
- Code review requests
- Testing status

---

## ✅ Definition of Done

A feature is considered "done" when:
- [ ] Code implemented and committed
- [ ] Unit tests written (>80% coverage)
- [ ] Integration tests passing
- [ ] Manual testing completed
- [ ] Code reviewed and approved
- [ ] Documentation updated
- [ ] Deployed to staging
- [ ] QA sign-off received
- [ ] No P0/P1 bugs
- [ ] Performance benchmarks met

---

**Last Updated:** February 10, 2026  
**Next Review:** February 17, 2026 (Sprint 1 Mid-Point)

**Ready to start? Begin with Sprint 1, Task DB-001!** 🚀
