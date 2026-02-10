# Database Schema Extensions for AI Agentic System

**Purpose:** This file contains all new Prisma models needed for the AI Agentic Automation features.  
**Status:** Ready to append to `prisma/schema.prisma`  
**Date:** February 10, 2026

---

## Instructions

1. Copy the models below
2. Append to the end of `prisma/schema.prisma`
3. Run `npx prisma generate`
4. Run `npx prisma migrate dev --name add_agentic_features`

---

## New Models

```prisma
// ============================================
// DRIP CAMPAIGN SYSTEM
// ============================================

model DripCampaign {
  id          String   @id @default(uuid())
  name        String
  description String?
  teamId      String
  
  // Trigger Configuration
  triggerType       String   // MANUAL, LEAD_CREATED, LEAD_SCORED, WEBHOOK, TAG_ADDED
  triggerConditions Json?    // { "intentScore": { "gte": 0.7 }, "tags": ["enterprise"] }
  
  // Sequence Steps
  steps       DripStep[]
  
  // State & Metrics
  isActive        Boolean  @default(false)
  enrolledLeads   Int      @default(0)
  completedLeads  Int      @default(0)
  activeLeads     Int      @default(0)
  
  // Performance
  totalSent       Int      @default(0)
  totalOpens      Int      @default(0)
  totalReplies    Int      @default(0)
  totalMeetings   Int      @default(0)
  
  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt
  createdBy   String?
  
  team        Team             @relation(fields: [teamId], references: [id])
  enrollments DripEnrollment[]
  
  @@index([teamId])
  @@index([isActive])
}

model DripStep {
  id            String   @id @default(uuid())
  campaignId    String
  stepNumber    Int      // 1, 2, 3...
  
  // Timing Configuration
  delayDays     Int      @default(0)
  delayHours    Int      @default(0)
  delayMinutes  Int      @default(0)
  sendTime      String?  // "09:00" for specific time (optional)
  timezone      String   @default("UTC")
  
  // Channel Selection
  channel       String   // EMAIL, LINKEDIN, WHATSAPP, CALL, SMS
  
  // Content
  templateId    String?
  subject       String?
  body          String?  @db.Text
  attachments   Json?    // [{ "name": "brochure.pdf", "url": "..." }]
  
  // Personalization
  useAI         Boolean  @default(false)
  aiPrompt      String?  @db.Text
  
  // Conditional Logic
  skipConditions Json?   // { "replied": true, "opened": true, "clicked": true }
  exitConditions Json?   // { "unsubscribed": true, "bounced": true }
  
  // A/B Testing
  variants      Json?    // [{ "subject": "...", "body": "...", "weight": 50 }]
  
  campaign      DripCampaign @relation(fields: [campaignId], references: [id], onDelete: Cascade)
  
  @@unique([campaignId, stepNumber])
  @@index([campaignId])
}

model DripEnrollment {
  id            String   @id @default(uuid())
  campaignId    String
  leadId        String
  
  // Progress Tracking
  currentStep   Int      @default(0)
  status        String   @default("ACTIVE") // ACTIVE, PAUSED, COMPLETED, EXITED
  
  // Timestamps
  enrolledAt    DateTime @default(now())
  lastStepAt    DateTime?
  completedAt   DateTime?
  
  // Exit Information
  exitReason    String?  // REPLIED, UNSUBSCRIBED, BOUNCED, MANUAL, COMPLETED
  exitStepNumber Int?
  
  // Metrics
  emailsSent    Int      @default(0)
  emailsOpened  Int      @default(0)
  emailsClicked Int      @default(0)
  replied       Boolean  @default(false)
  
  campaign      DripCampaign @relation(fields: [campaignId], references: [id], onDelete: Cascade)
  lead          Lead         @relation(fields: [leadId], references: [id], onDelete: Cascade)
  
  @@unique([campaignId, leadId])
  @@index([status])
  @@index([leadId])
}

// ============================================
// UNIFIED INBOX SYSTEM
// ============================================

model UnifiedMessage {
  id          String   @id @default(uuid())
  leadId      String
  threadId    String   // Groups related messages
  
  // Channel & Direction
  channel     String   // EMAIL, LINKEDIN, WHATSAPP, SMS, CALL
  direction   String   // INBOUND, OUTBOUND
  
  // Content
  subject     String?
  body        String   @db.Text
  htmlBody    String?  @db.Text
  attachments Json?
  
  // Participants
  sender      String
  recipient   String
  cc          String[]  @default([])
  bcc         String[]  @default([])
  
  // Metadata
  externalId  String?  // Provider's message ID (for deduplication)
  messageId   String?  // Email Message-ID header
  inReplyTo   String?  // Email In-Reply-To header
  
  // State
  isRead      Boolean  @default(false)
  isStarred   Boolean  @default(false)
  isArchived  Boolean  @default(false)
  
  // AI Analysis
  sentiment   String?  // POSITIVE, NEUTRAL, NEGATIVE
  intent      String?  // INTERESTED, QUESTION, OBJECTION, BOOKING, PRICING
  priority    Int      @default(0) // 0-10 scale
  aiSummary   String?  @db.Text
  
  // Assignment
  assignedTo  String?  // User ID for HITL
  assignedAt  DateTime?
  
  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt
  
  lead        Lead     @relation(fields: [leadId], references: [id], onDelete: Cascade)
  
  @@index([threadId])
  @@index([leadId])
  @@index([channel, direction])
  @@index([isRead, isArchived])
  @@index([assignedTo])
  @@index([createdAt])
}

// ============================================
// DELIVERABILITY SUITE
// ============================================

model TeamInbox {
  id             String  @id @default(uuid())
  teamId         String
  
  // Inbox Details
  email          String
  displayName    String?
  
  // SMTP Configuration
  smtpHost       String
  smtpPort       Int
  smtpUser       String
  smtpPass       String  @db.Text // Encrypted
  smtpSecure     Boolean @default(true)
  
  // IMAP Configuration (for reply tracking)
  imapHost       String?
  imapPort       Int?
  imapUser       String?
  imapPass       String? @db.Text
  
  // Provider Information
  provider       String  // GMAIL, OUTLOOK, SENDGRID, CUSTOM
  esp            String  // Detected ESP for matching
  
  // Sending Limits
  dailyLimit     Int     @default(500)
  hourlyLimit    Int     @default(50)
  dailySentCount Int     @default(0)
  hourlySentCount Int    @default(0)
  lastResetAt    DateTime @default(now())
  
  // Warmup Status
  isWarmingUp    Boolean @default(true)
  warmupDay      Int     @default(0)
  warmupTarget   Int     @default(30) // Days to complete warmup
  
  // Health Metrics
  deliverabilityScore Float   @default(100.0)
  bounceRate          Float   @default(0.0)
  spamRate            Float   @default(0.0)
  replyRate           Float   @default(0.0)
  
  // State
  isActive       Boolean @default(true)
  isPaused       Boolean @default(false)
  pausedReason   String?
  
  createdAt      DateTime @default(now())
  updatedAt      DateTime @updatedAt
  
  team           Team    @relation(fields: [teamId], references: [id], onDelete: Cascade)
  
  @@unique([teamId, email])
  @@index([teamId])
  @@index([isActive, isPaused])
}

model EmailVerification {
  id              String   @id @default(uuid())
  leadId          String
  email           String
  
  // Verification Results
  isValid         Boolean
  isDisposable    Boolean  @default(false)
  isCatchAll      Boolean  @default(false)
  isFreeProvider  Boolean  @default(false)
  
  // Scoring
  score           Int      // 0-100
  confidence      String   // HIGH, MEDIUM, LOW
  
  // Provider Details
  provider        String?  // HUNTER, ZEROBOUNCE, NEVERBOUNCE
  providerResponse Json?
  
  // SMTP Check
  smtpValid       Boolean?
  mxRecords       Json?
  
  verifiedAt      DateTime @default(now())
  
  lead            Lead     @relation(fields: [leadId], references: [id], onDelete: Cascade)
  
  @@unique([leadId, email])
  @@index([leadId])
  @@index([isValid])
}

model WarmupActivity {
  id              String   @id @default(uuid())
  inboxId         String
  
  day             Int
  emailsSent      Int
  emailsReceived  Int
  emailsOpened    Int
  emailsReplied   Int
  
  // Conversation Partners
  recipientEmails Json     // Array of warmup pool emails used
  
  // Performance
  avgDeliveryTime Int?     // Milliseconds
  bounces         Int      @default(0)
  
  executedAt      DateTime @default(now())
  
  inbox           TeamInbox @relation(fields: [inboxId], references: [id], onDelete: Cascade)
  
  @@index([inboxId, day])
}

// ============================================
// LINKEDIN AUTOMATION
// ============================================

model LinkedInActivity {
  id              String   @id @default(uuid())
  leadId          String
  
  activityType    String   // CONNECTION_REQUEST, MESSAGE, PROFILE_VIEW, POST_LIKE, POST_COMMENT
  
  // Content
  message         String?  @db.Text
  noteText        String?  @db.Text
  
  // Status
  status          String   @default("PENDING") // PENDING, SENT, ACCEPTED, REJECTED, FAILED
  
  // Metadata
  profileUrl      String
  conversationId  String?  // LinkedIn conversation ID
  
  // Timing
  scheduledFor    DateTime?
  executedAt      DateTime?
  
  // Result
  success         Boolean  @default(false)
  errorMessage    String?
  
  createdAt       DateTime @default(now())
  
  lead            Lead     @relation(fields: [leadId], references: [id], onDelete: Cascade)
  
  @@index([leadId])
  @@index([status])
  @@index([scheduledFor])
}

// ============================================
// ANALYTICS & REPORTING
// ============================================

model CampaignMetrics {
  id              String   @id @default(uuid())
  campaignId      String
  date            DateTime @default(now())
  
  // Volume Metrics
  emailsSent      Int      @default(0)
  emailsDelivered Int      @default(0)
  emailsBounced   Int      @default(0)
  
  // Engagement Metrics
  uniqueOpens     Int      @default(0)
  totalOpens      Int      @default(0)
  uniqueClicks    Int      @default(0)
  totalClicks     Int      @default(0)
  
  // Conversion Metrics
  replies         Int      @default(0)
  positiveReplies Int      @default(0)
  meetings        Int      @default(0)
  deals           Int      @default(0)
  
  // Rates (calculated)
  deliveryRate    Float    @default(0.0)
  openRate        Float    @default(0.0)
  clickRate       Float    @default(0.0)
  replyRate       Float    @default(0.0)
  conversionRate  Float    @default(0.0)
  
  // Revenue
  revenue         Float    @default(0.0)
  
  campaign        Campaign @relation(fields: [campaignId], references: [id], onDelete: Cascade)
  
  @@unique([campaignId, date])
  @@index([campaignId])
  @@index([date])
}

// ============================================
// SEQUENCE TEMPLATES
// ============================================

model SequenceTemplate {
  id              String   @id @default(uuid())
  name            String
  description     String?
  teamId          String?  // NULL = global template
  
  // Category
  industry        String?  // SAAS, ECOMMERCE, CONSULTING
  useCase         String?  // COLD_OUTREACH, FOLLOWUP, NURTURE
  
  // Steps
  steps           Json     // Array of step configurations
  
  // Performance (from usage)
  timesUsed       Int      @default(0)
  avgReplyRate    Float?
  avgMeetingRate  Float?
  
  // State
  isPublic        Boolean  @default(false)
  isActive        Boolean  @default(true)
  
  createdAt       DateTime @default(now())
  updatedAt       DateTime @updatedAt
  createdBy       String?
  
  team            Team?    @relation(fields: [teamId], references: [id], onDelete: Cascade)
  
  @@index([teamId])
  @@index([industry, useCase])
}

// ============================================
// RELATION UPDATES TO EXISTING MODELS
// ============================================

// Add these relations to existing models:

// Lead model additions:
//   dripEnrollments   DripEnrollment[]
//   unifiedMessages   UnifiedMessage[]
//   emailVerifications EmailVerification[]
//   linkedInActivities LinkedInActivity[]

// Team model additions:
//   dripCampaigns     DripCampaign[]
//   teamInboxes       TeamInbox[]
//   sequenceTemplates SequenceTemplate[]

// Campaign model additions:
//   metrics           CampaignMetrics[]
```

---

## Migration Notes

### Breaking Changes
- None. All new models are additive.

### Data Migration Required
- None for new installations.
- Existing installations: No data migration needed.

### Post-Migration Steps
1. Run `npx prisma generate` to update Prisma Client
2. Restart the application
3. Verify new tables exist in database
4. Run seed script if needed: `npm run db:seed`

---

## Indexes Rationale

### Performance-Critical Indexes
- `DripEnrollment.status` - Frequent filtering in dashboards
- `UnifiedMessage.threadId` - Conversation grouping
- `UnifiedMessage.isRead` - Inbox filtering
- `TeamInbox.isActive` - Inbox selection for sending
- `LinkedInActivity.scheduledFor` - Scheduler queries

### Composite Indexes
- `DripStep.[campaignId, stepNumber]` - Step ordering
- `CampaignMetrics.[campaignId, date]` - Time-series analytics

---

## Estimated Database Size Impact

Assuming 10,000 leads and 100 campaigns:

| Model | Rows | Size per Row | Total Size |
|-------|------|--------------|------------|
| DripCampaign | 100 | 2 KB | 200 KB |
| DripStep | 500 | 1 KB | 500 KB |
| DripEnrollment | 50,000 | 500 B | 25 MB |
| UnifiedMessage | 200,000 | 2 KB | 400 MB |
| TeamInbox | 20 | 1 KB | 20 KB |
| EmailVerification | 10,000 | 500 B | 5 MB |
| LinkedInActivity | 30,000 | 1 KB | 30 MB |
| CampaignMetrics | 3,000 | 500 B | 1.5 MB |

**Total Additional Storage:** ~462 MB (for 10K leads)

---

## Next Steps

1. Review schema with team
2. Test migrations in development
3. Create seed data for testing
4. Update API documentation
5. Deploy to staging
