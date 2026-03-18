-- CreateExtension
CREATE EXTENSION IF NOT EXISTS "vector";

-- CreateEnum
CREATE TYPE "Region" AS ENUM ('GLOBAL', 'UAE', 'EU');

-- CreateEnum
CREATE TYPE "ConversationState" AS ENUM ('INITIATED', 'ENGAGED', 'QUALIFIED', 'HANDOFF_REQUIRED', 'COORDINATING', 'MEETING_CONFIRMED', 'CLOSED');

-- CreateEnum
CREATE TYPE "CapabilityLayer" AS ENUM ('CORE', 'GOVERNED_AI', 'ADVANCED_OPS', 'EXPERIMENTAL');

-- CreateEnum
CREATE TYPE "ProductMode" AS ENUM ('ENTERPRISE_CORE', 'GROWTH', 'ALL_FEATURES');

-- CreateEnum
CREATE TYPE "UserRole" AS ENUM ('SYSTEM_ADMIN', 'ORG_ADMIN', 'SALES_MANAGER', 'SALES_USER', 'CALLER', 'COMPLIANCE_OFFICER');

-- CreateEnum
CREATE TYPE "ConsentStatus" AS ENUM ('GRANTED', 'REVOKED', 'EXPIRED');

-- CreateEnum
CREATE TYPE "TrainingTaskType" AS ENUM ('TONE_NORMALIZATION', 'GRAMMAR_REPAIR', 'BRAND_ENFORCEMENT', 'POLICY_CLASSIFICATION', 'POLICY_REWRITE', 'CONVERSATION_SUMMARY', 'OBJECTION_EXTRACTION', 'REFUSAL_GENERATION');

-- CreateEnum
CREATE TYPE "DatasetStatus" AS ENUM ('DRAFT', 'IN_REVIEW', 'REVIEWED', 'TRAINING', 'DEPLOYED');

-- CreateEnum
CREATE TYPE "ModelStatus" AS ENUM ('TRAINING', 'VALIDATION', 'DEPLOYED', 'ROLLED_BACK', 'DEPRECATED');

-- AlterTable
ALTER TABLE "AuditLog" ADD COLUMN     "correlationId" TEXT;

-- AlterTable
ALTER TABLE "AutomationLog" ADD COLUMN     "durationMs" INTEGER DEFAULT 0,
ADD COLUMN     "executedAt" TIMESTAMP(3),
ADD COLUMN     "input" JSONB,
ADD COLUMN     "metadata" JSONB,
ADD COLUMN     "reasoning" TEXT;

-- AlterTable
ALTER TABLE "Campaign" ADD COLUMN     "consecutiveFailures" INTEGER NOT NULL DEFAULT 0;

-- AlterTable
ALTER TABLE "GuardrailLog" ADD COLUMN     "metadata" JSONB,
ADD COLUMN     "violationType" TEXT NOT NULL;

-- AlterTable
ALTER TABLE "GuardrailPolicy" ADD COLUMN     "competitorMentions" TEXT[],
ADD COLUMN     "regexRules" TEXT[];

-- AlterTable
ALTER TABLE "Job" ADD COLUMN     "auditContext" JSONB,
ADD COLUMN     "correlationId" TEXT,
ADD COLUMN     "executionMode" TEXT,
ADD COLUMN     "expiresAt" TIMESTAMP(3),
ADD COLUMN     "idempotencyKey" TEXT,
ADD COLUMN     "policy" JSONB,
ADD COLUMN     "targetRuntime" TEXT,
ADD COLUMN     "taskId" TEXT,
ADD COLUMN     "taskType" TEXT,
ADD COLUMN     "tenantId" TEXT,
ADD COLUMN     "version" INTEGER DEFAULT 1,
ALTER COLUMN "status" SET DEFAULT 'queued';

-- AlterTable
ALTER TABLE "Lead" ADD COLUMN     "churnRisk" DOUBLE PRECISION,
ADD COLUMN     "clusterLabel" TEXT,
ADD COLUMN     "consentObtained" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "crmId" TEXT,
ADD COLUMN     "crmSyncedAt" TIMESTAMP(3),
ADD COLUMN     "dwellTimeMinutes" DOUBLE PRECISION DEFAULT 0.0,
ADD COLUMN     "emailClicks" INTEGER DEFAULT 0,
ADD COLUMN     "hotAt" TIMESTAMP(3),
ADD COLUMN     "intentScore" DOUBLE PRECISION DEFAULT 0.0,
ADD COLUMN     "lastScoredAt" TIMESTAMP(3),
ADD COLUMN     "leadScore" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "lostAt" TIMESTAMP(3),
ADD COLUMN     "marketContext" JSONB,
ADD COLUMN     "meetingLocation" TEXT,
ADD COLUMN     "optimalSendHour" INTEGER,
ADD COLUMN     "phone" TEXT,
ADD COLUMN     "pipelineState" TEXT NOT NULL DEFAULT 'COLD',
ADD COLUMN     "pipelineStateChangedAt" TIMESTAMP(3),
ADD COLUMN     "preferredMeetingType" TEXT,
ADD COLUMN     "regionId" "Region" NOT NULL DEFAULT 'GLOBAL',
ADD COLUMN     "socialMentions" INTEGER DEFAULT 0,
ADD COLUMN     "whatsappConsent" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "whatsappConsentAt" TIMESTAMP(3),
ADD COLUMN     "whatsappConsentBy" TEXT,
ADD COLUMN     "whatsappNumber" TEXT,
ALTER COLUMN "embedding" SET DATA TYPE TEXT;

-- AlterTable
ALTER TABLE "Message" ADD COLUMN     "sentimentScore" DOUBLE PRECISION;

-- AlterTable
ALTER TABLE "Subscription" DROP COLUMN "stripeCustomerId",
DROP COLUMN "stripeSubscriptionId";

-- AlterTable
ALTER TABLE "Team" ADD COLUMN     "aiConfig" JSONB;

-- AlterTable
ALTER TABLE "User" ADD COLUMN     "callerActiveAt" TIMESTAMP(3),
ADD COLUMN     "callerMaxQueueSize" INTEGER NOT NULL DEFAULT 10,
ADD COLUMN     "callerTeamId" TEXT,
ADD COLUMN     "edgeNodeUri" TEXT,
ADD COLUMN     "enterpriseRole" "UserRole" NOT NULL DEFAULT 'SALES_USER',
ADD COLUMN     "isCaller" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "WorkflowRun" ADD COLUMN     "reasoning" TEXT,
ADD COLUMN     "tokensUsed" INTEGER NOT NULL DEFAULT 0;

-- DropTable
DROP TABLE "ActivityLog";

-- CreateTable
CREATE TABLE "Generation" (
    "id" TEXT NOT NULL,
    "leadId" TEXT NOT NULL,
    "promptPayload" JSONB NOT NULL,
    "generatedText" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "conversionValue" DOUBLE PRECISION NOT NULL DEFAULT 0.0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Generation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Task" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "dueDate" TIMESTAMP(3),
    "status" TEXT NOT NULL DEFAULT 'TODO',
    "priority" TEXT NOT NULL DEFAULT 'MEDIUM',
    "leadId" TEXT,
    "userId" TEXT NOT NULL,
    "teamId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Task_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "JobRun" (
    "id" TEXT NOT NULL,
    "jobId" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "errorCode" TEXT,
    "errorMessage" TEXT,
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "finishedAt" TIMESTAMP(3),
    "retryCount" INTEGER NOT NULL DEFAULT 0,
    "correlationId" TEXT,

    CONSTRAINT "JobRun_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ScrapingJob" (
    "id" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "region" "Region" NOT NULL DEFAULT 'GLOBAL',
    "payload" JSONB,
    "tokenMap" JSONB,
    "error" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "teamId" TEXT,

    CONSTRAINT "ScrapingJob_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ManualReview" (
    "id" TEXT NOT NULL,
    "source" TEXT NOT NULL,
    "payload" JSONB NOT NULL,
    "reason" TEXT NOT NULL,
    "severity" TEXT NOT NULL,
    "region" TEXT NOT NULL DEFAULT 'GLOBAL',
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "reviewedBy" TEXT,
    "reviewedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ManualReview_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CrmIntegration" (
    "id" TEXT NOT NULL,
    "teamId" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "accessToken" TEXT,
    "refreshToken" TEXT,
    "expiresAt" TIMESTAMP(3),
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "fieldMapping" JSONB,
    "syncSettings" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CrmIntegration_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SsoConfiguration" (
    "id" TEXT NOT NULL,
    "teamId" TEXT NOT NULL,
    "providerType" TEXT NOT NULL DEFAULT 'SAML',
    "metadataUrl" TEXT,
    "issuer" TEXT,
    "entryPoint" TEXT,
    "certificate" TEXT,
    "clientId" TEXT,
    "clientSecret" TEXT,
    "wellKnownUrl" TEXT,
    "enforced" BOOLEAN NOT NULL DEFAULT false,
    "allowedDomains" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SsoConfiguration_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WebhookLog" (
    "id" TEXT NOT NULL,
    "webhookId" TEXT NOT NULL,
    "event" TEXT NOT NULL,
    "status" INTEGER NOT NULL,
    "payload" JSONB NOT NULL,
    "response" JSONB,
    "error" TEXT,
    "duration" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "WebhookLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AiTrace" (
    "id" TEXT NOT NULL,
    "runId" TEXT,
    "stepName" TEXT NOT NULL,
    "input" TEXT,
    "output" TEXT,
    "reasoning" TEXT,
    "model" TEXT,
    "latency" INTEGER NOT NULL,
    "tokens" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AiTrace_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "KnowledgeBase" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "teamId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "KnowledgeBase_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "KnowledgeItem" (
    "id" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "embedding" TEXT,
    "embeddingModel" TEXT DEFAULT 'gemini-1.5-flash',
    "version" INTEGER DEFAULT 1,
    "metadata" JSONB,
    "knowledgeBaseId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "KnowledgeItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OrganizationPolicy" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "productMode" "ProductMode" NOT NULL DEFAULT 'ENTERPRISE_CORE',
    "executionMode" TEXT DEFAULT 'saas_only',
    "productSurface" TEXT DEFAULT 'outreach',
    "maxDailyActions" INTEGER NOT NULL DEFAULT 200,
    "maxCampaigns" INTEGER NOT NULL DEFAULT 10,
    "maxAgents" INTEGER NOT NULL DEFAULT 5,
    "allowInMail" BOOLEAN NOT NULL DEFAULT false,
    "allowScraping" BOOLEAN NOT NULL DEFAULT false,
    "allowUploads" BOOLEAN NOT NULL DEFAULT true,
    "requiresApprovalForCampaign" BOOLEAN NOT NULL DEFAULT false,
    "blockedKeywords" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "detectPII" BOOLEAN NOT NULL DEFAULT false,
    "restrictedTone" TEXT,
    "maxCreditsPerUser" INTEGER NOT NULL DEFAULT 50,
    "requiresApprovalForOverage" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "OrganizationPolicy_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "UserQuota" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "teamId" TEXT NOT NULL,
    "monthlyLimit" INTEGER NOT NULL,
    "currentSpend" INTEGER NOT NULL DEFAULT 0,
    "lastReset" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "UserQuota_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ApprovalRequest" (
    "id" TEXT NOT NULL,
    "teamId" TEXT NOT NULL,
    "requesterId" TEXT NOT NULL,
    "actionType" TEXT NOT NULL,
    "entityType" TEXT NOT NULL,
    "entityId" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "reason" TEXT,
    "payload" JSONB,
    "reviewerId" TEXT,
    "reviewNote" TEXT,
    "reviewedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ApprovalRequest_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Playbook" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "teamId" TEXT NOT NULL,
    "config" JSONB NOT NULL,
    "parameters" JSONB,
    "isLocked" BOOLEAN NOT NULL DEFAULT false,
    "visibility" TEXT NOT NULL DEFAULT 'INTERNAL',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Playbook_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CaseStudy" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "industry" TEXT NOT NULL,
    "summary" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "metrics" JSONB,
    "embedding" TEXT,
    "embeddingModel" TEXT DEFAULT 'embedding-001',
    "teamId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CaseStudy_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "VerificationLog" (
    "id" TEXT NOT NULL,
    "leadId" TEXT NOT NULL,
    "teamId" TEXT NOT NULL,
    "passed" BOOLEAN NOT NULL,
    "score" DOUBLE PRECISION NOT NULL,
    "threshold" DOUBLE PRECISION NOT NULL,
    "recommendation" TEXT NOT NULL,
    "violations" JSONB,
    "explanation" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "VerificationLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AgentTask" (
    "id" TEXT NOT NULL,
    "teamId" TEXT NOT NULL,
    "userId" TEXT,
    "goal" TEXT NOT NULL,
    "plan" JSONB,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "context" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AgentTask_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AgentLog" (
    "id" TEXT NOT NULL,
    "taskId" TEXT NOT NULL,
    "stepNumber" INTEGER NOT NULL,
    "type" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AgentLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AgentFeedbackLoop" (
    "id" TEXT NOT NULL,
    "teamId" TEXT NOT NULL,
    "originalText" TEXT NOT NULL,
    "editedText" TEXT NOT NULL,
    "diff" JSONB,
    "context" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AgentFeedbackLoop_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LLMUsageLog" (
    "id" TEXT NOT NULL,
    "teamId" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "model" TEXT NOT NULL,
    "taskType" TEXT NOT NULL,
    "tokensIn" INTEGER NOT NULL,
    "tokensOut" INTEGER NOT NULL,
    "cost" DOUBLE PRECISION NOT NULL,
    "latency" INTEGER NOT NULL,
    "success" BOOLEAN NOT NULL,
    "error" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "LLMUsageLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EdgeNode" (
    "id" TEXT NOT NULL,
    "teamId" TEXT NOT NULL,
    "hardwareId" TEXT NOT NULL,
    "ipAddress" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'OFFLINE',
    "lastSync" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "EdgeNode_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "patent_guardrails" (
    "id" TEXT NOT NULL,
    "claimText" TEXT NOT NULL,
    "patentId" TEXT NOT NULL,
    "riskLevel" TEXT NOT NULL DEFAULT 'HIGH',
    "vector" vector(1536),

    CONSTRAINT "patent_guardrails_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LocalFeedbackLoop" (
    "id" TEXT NOT NULL,
    "originalPrompt" TEXT NOT NULL,
    "agentOutput" TEXT NOT NULL,
    "userCorrection" TEXT NOT NULL,
    "sourceTool" TEXT NOT NULL,
    "isSynced" BOOLEAN NOT NULL DEFAULT false,
    "teamId" TEXT NOT NULL,

    CONSTRAINT "LocalFeedbackLoop_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LLMCache" (
    "id" TEXT NOT NULL,
    "prompt" TEXT NOT NULL,
    "promptHash" TEXT NOT NULL,
    "response" TEXT NOT NULL,
    "embedding" vector(1536),
    "tokensIn" INTEGER NOT NULL DEFAULT 0,
    "tokensOut" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "expiresAt" TIMESTAMP(3),

    CONSTRAINT "LLMCache_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SystemEvent" (
    "id" TEXT NOT NULL,
    "correlationId" TEXT,
    "type" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "actorId" TEXT,
    "teamId" TEXT NOT NULL,
    "payload" JSONB NOT NULL,
    "timestamp" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SystemEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "KnowledgePerformance" (
    "id" TEXT NOT NULL,
    "knowledgeItemId" TEXT NOT NULL,
    "rewardScore" DOUBLE PRECISION NOT NULL DEFAULT 0.0,
    "usageCount" INTEGER NOT NULL DEFAULT 0,
    "replies" INTEGER NOT NULL DEFAULT 0,
    "clicks" INTEGER NOT NULL DEFAULT 0,
    "bounces" INTEGER NOT NULL DEFAULT 0,
    "lastSuccessAt" TIMESTAMP(3),

    CONSTRAINT "KnowledgePerformance_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Experiment" (
    "id" TEXT NOT NULL,
    "teamId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "goal" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'RUNNING',
    "controlId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Experiment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ExperimentVariant" (
    "id" TEXT NOT NULL,
    "experimentId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "config" JSONB NOT NULL,
    "sampleCount" INTEGER NOT NULL DEFAULT 0,
    "successCount" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "ExperimentVariant_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ImmutableAudit" (
    "id" TEXT NOT NULL,
    "sequence" BIGSERIAL NOT NULL,
    "eventId" TEXT NOT NULL,
    "teamId" TEXT NOT NULL,
    "narrative" TEXT NOT NULL,
    "hash" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ImmutableAudit_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ConversationEntry" (
    "id" TEXT NOT NULL,
    "leadId" TEXT NOT NULL,
    "role" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "conversationThreadId" TEXT,

    CONSTRAINT "ConversationEntry_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ConversationThread" (
    "id" TEXT NOT NULL,
    "leadId" TEXT NOT NULL,
    "state" "ConversationState" NOT NULL DEFAULT 'INITIATED',
    "channel" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ConversationThread_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WhatsAppMessage" (
    "id" TEXT NOT NULL,
    "leadId" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "direction" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'sent',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "WhatsAppMessage_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MeetingCoordinationQueue" (
    "id" TEXT NOT NULL,
    "leadId" TEXT NOT NULL,
    "assignedUserId" TEXT,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "priority" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MeetingCoordinationQueue_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FeatureFlag" (
    "id" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "isEnabled" BOOLEAN NOT NULL DEFAULT false,
    "layer" "CapabilityLayer" NOT NULL DEFAULT 'EXPERIMENTAL',
    "description" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "FeatureFlag_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ConsentLedger" (
    "id" TEXT NOT NULL,
    "leadId" TEXT NOT NULL,
    "userId" TEXT,
    "channel" TEXT NOT NULL,
    "purpose" TEXT NOT NULL,
    "status" "ConsentStatus" NOT NULL DEFAULT 'GRANTED',
    "proof" TEXT,
    "notes" TEXT,
    "grantedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "revokedAt" TIMESTAMP(3),
    "ipAddress" TEXT,

    CONSTRAINT "ConsentLedger_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ContractProfile" (
    "id" TEXT NOT NULL,
    "teamId" TEXT NOT NULL,
    "allowedChannels" TEXT[],
    "allowedCapabilityLayers" TEXT[],
    "aiUsageLimit" INTEGER NOT NULL DEFAULT 1000,
    "conversationThreadLimit" INTEGER NOT NULL DEFAULT 50,
    "humanHandoffLimit" INTEGER NOT NULL DEFAULT 10,
    "onPremRequired" BOOLEAN NOT NULL DEFAULT false,
    "dataRetentionDays" INTEGER NOT NULL DEFAULT 90,
    "featureTier" TEXT NOT NULL DEFAULT 'CORE',
    "contractStatus" TEXT NOT NULL DEFAULT 'ACTIVE',
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ContractProfile_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TrainingDataset" (
    "id" TEXT NOT NULL,
    "version" TEXT NOT NULL,
    "taskType" "TrainingTaskType" NOT NULL,
    "recordCount" INTEGER NOT NULL DEFAULT 0,
    "datasetHash" TEXT NOT NULL,
    "configHash" TEXT NOT NULL,
    "status" "DatasetStatus" NOT NULL DEFAULT 'DRAFT',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TrainingDataset_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TrainingRecord" (
    "id" TEXT NOT NULL,
    "datasetId" TEXT NOT NULL,
    "taskType" "TrainingTaskType" NOT NULL,
    "inputText" TEXT NOT NULL,
    "brandRules" JSONB NOT NULL,
    "policyRules" JSONB NOT NULL,
    "expectedOutput" TEXT NOT NULL,
    "rejectionConditions" JSONB NOT NULL,
    "reviewScore" DOUBLE PRECISION,
    "reviewedBy" TEXT,
    "reviewedAt" TIMESTAMP(3),
    "approved" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TrainingRecord_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DatasetReview" (
    "id" TEXT NOT NULL,
    "datasetId" TEXT NOT NULL,
    "reviewerId" TEXT NOT NULL,
    "sampleSize" INTEGER NOT NULL,
    "avgScore" DOUBLE PRECISION NOT NULL,
    "policyCorrectness" DOUBLE PRECISION NOT NULL,
    "toneQuality" DOUBLE PRECISION NOT NULL,
    "clarity" DOUBLE PRECISION NOT NULL,
    "realism" DOUBLE PRECISION NOT NULL,
    "refusalQuality" DOUBLE PRECISION,
    "notes" TEXT,
    "approved" BOOLEAN NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "DatasetReview_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ModelVersion" (
    "id" TEXT NOT NULL,
    "version" TEXT NOT NULL,
    "baseModel" TEXT NOT NULL,
    "datasetId" TEXT NOT NULL,
    "configHash" TEXT NOT NULL,
    "changelog" TEXT NOT NULL,
    "status" "ModelStatus" NOT NULL DEFAULT 'TRAINING',
    "refusalAccuracy" DOUBLE PRECISION,
    "policyViolationRate" DOUBLE PRECISION,
    "driftScore" DOUBLE PRECISION,
    "verbosityScore" DOUBLE PRECISION,
    "deployedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ModelVersion_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EvaluationMetric" (
    "id" TEXT NOT NULL,
    "modelVersionId" TEXT NOT NULL,
    "metricType" TEXT NOT NULL,
    "value" DOUBLE PRECISION NOT NULL,
    "threshold" DOUBLE PRECISION NOT NULL,
    "passed" BOOLEAN NOT NULL,
    "metadata" JSONB,
    "timestamp" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "EvaluationMetric_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ReplyTracker" (
    "id" TEXT NOT NULL,
    "leadId" TEXT NOT NULL,
    "emailId" TEXT,
    "receivedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "senderEmail" TEXT NOT NULL,
    "subject" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "aiClassification" TEXT NOT NULL,
    "aiConfidence" DOUBLE PRECISION NOT NULL,
    "aiReasoning" TEXT,
    "sentimentScore" DOUBLE PRECISION,
    "status" TEXT NOT NULL DEFAULT 'PENDING_REVIEW',
    "humanCorrection" TEXT,
    "reviewedBy" TEXT,
    "reviewedAt" TIMESTAMP(3),
    "actionTaken" TEXT,
    "replyDraft" TEXT,

    CONSTRAINT "ReplyTracker_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CalendarEvent" (
    "id" TEXT NOT NULL,
    "eventName" TEXT NOT NULL,
    "eventDate" TIMESTAMP(3) NOT NULL,
    "category" TEXT NOT NULL,
    "leadGenAngle" TEXT NOT NULL,
    "newsletterId" TEXT,

    CONSTRAINT "CalendarEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Newsletter" (
    "id" TEXT NOT NULL,
    "subjectLine" TEXT NOT NULL,
    "emailBodyHtml" TEXT NOT NULL,
    "cta" TEXT NOT NULL,

    CONSTRAINT "Newsletter_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ShadowSignal" (
    "id" TEXT NOT NULL,
    "source" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "frictionScore" DOUBLE PRECISION NOT NULL,
    "detectedICPs" TEXT[],
    "isWarmLead" BOOLEAN NOT NULL DEFAULT false,
    "metadata" JSONB,
    "leadId" TEXT,
    "teamId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ShadowSignal_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "VectorDocument" (
    "id" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "metadata" TEXT,
    "embedding" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "VectorDocument_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EngagementLog" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "event" TEXT NOT NULL,
    "context" TEXT,
    "result" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "EngagementLog_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Generation_leadId_idx" ON "Generation"("leadId");

-- CreateIndex
CREATE INDEX "Generation_status_idx" ON "Generation"("status");

-- CreateIndex
CREATE INDEX "Task_teamId_idx" ON "Task"("teamId");

-- CreateIndex
CREATE INDEX "Task_userId_idx" ON "Task"("userId");

-- CreateIndex
CREATE INDEX "Task_leadId_idx" ON "Task"("leadId");

-- CreateIndex
CREATE INDEX "Task_status_idx" ON "Task"("status");

-- CreateIndex
CREATE INDEX "JobRun_jobId_idx" ON "JobRun"("jobId");

-- CreateIndex
CREATE INDEX "JobRun_status_idx" ON "JobRun"("status");

-- CreateIndex
CREATE INDEX "JobRun_startedAt_idx" ON "JobRun"("startedAt");

-- CreateIndex
CREATE INDEX "ScrapingJob_status_idx" ON "ScrapingJob"("status");

-- CreateIndex
CREATE INDEX "ScrapingJob_region_idx" ON "ScrapingJob"("region");

-- CreateIndex
CREATE INDEX "ManualReview_status_idx" ON "ManualReview"("status");

-- CreateIndex
CREATE INDEX "ManualReview_severity_idx" ON "ManualReview"("severity");

-- CreateIndex
CREATE UNIQUE INDEX "CrmIntegration_teamId_provider_key" ON "CrmIntegration"("teamId", "provider");

-- CreateIndex
CREATE UNIQUE INDEX "SsoConfiguration_teamId_key" ON "SsoConfiguration"("teamId");

-- CreateIndex
CREATE INDEX "WebhookLog_webhookId_idx" ON "WebhookLog"("webhookId");

-- CreateIndex
CREATE INDEX "WebhookLog_createdAt_idx" ON "WebhookLog"("createdAt");

-- CreateIndex
CREATE INDEX "AiTrace_runId_idx" ON "AiTrace"("runId");

-- CreateIndex
CREATE INDEX "KnowledgeBase_teamId_idx" ON "KnowledgeBase"("teamId");

-- CreateIndex
CREATE INDEX "KnowledgeItem_knowledgeBaseId_idx" ON "KnowledgeItem"("knowledgeBaseId");

-- CreateIndex
CREATE UNIQUE INDEX "OrganizationPolicy_organizationId_key" ON "OrganizationPolicy"("organizationId");

-- CreateIndex
CREATE UNIQUE INDEX "UserQuota_userId_teamId_key" ON "UserQuota"("userId", "teamId");

-- CreateIndex
CREATE INDEX "ApprovalRequest_teamId_idx" ON "ApprovalRequest"("teamId");

-- CreateIndex
CREATE INDEX "ApprovalRequest_status_idx" ON "ApprovalRequest"("status");

-- CreateIndex
CREATE INDEX "Playbook_teamId_idx" ON "Playbook"("teamId");

-- CreateIndex
CREATE INDEX "CaseStudy_teamId_idx" ON "CaseStudy"("teamId");

-- CreateIndex
CREATE INDEX "CaseStudy_industry_idx" ON "CaseStudy"("industry");

-- CreateIndex
CREATE INDEX "VerificationLog_leadId_idx" ON "VerificationLog"("leadId");

-- CreateIndex
CREATE INDEX "VerificationLog_teamId_idx" ON "VerificationLog"("teamId");

-- CreateIndex
CREATE INDEX "VerificationLog_createdAt_idx" ON "VerificationLog"("createdAt");

-- CreateIndex
CREATE INDEX "AgentTask_teamId_idx" ON "AgentTask"("teamId");

-- CreateIndex
CREATE INDEX "AgentTask_status_idx" ON "AgentTask"("status");

-- CreateIndex
CREATE INDEX "AgentLog_taskId_idx" ON "AgentLog"("taskId");

-- CreateIndex
CREATE INDEX "AgentLog_type_idx" ON "AgentLog"("type");

-- CreateIndex
CREATE INDEX "AgentLog_createdAt_idx" ON "AgentLog"("createdAt");

-- CreateIndex
CREATE INDEX "AgentLog_taskId_createdAt_idx" ON "AgentLog"("taskId", "createdAt");

-- CreateIndex
CREATE INDEX "AgentLog_taskId_type_idx" ON "AgentLog"("taskId", "type");

-- CreateIndex
CREATE INDEX "AgentFeedbackLoop_teamId_idx" ON "AgentFeedbackLoop"("teamId");

-- CreateIndex
CREATE INDEX "LLMUsageLog_teamId_createdAt_idx" ON "LLMUsageLog"("teamId", "createdAt");

-- CreateIndex
CREATE INDEX "LLMUsageLog_provider_createdAt_idx" ON "LLMUsageLog"("provider", "createdAt");

-- CreateIndex
CREATE INDEX "LLMUsageLog_taskType_idx" ON "LLMUsageLog"("taskType");

-- CreateIndex
CREATE UNIQUE INDEX "EdgeNode_teamId_key" ON "EdgeNode"("teamId");

-- CreateIndex
CREATE UNIQUE INDEX "EdgeNode_hardwareId_key" ON "EdgeNode"("hardwareId");

-- CreateIndex
CREATE UNIQUE INDEX "LLMCache_promptHash_key" ON "LLMCache"("promptHash");

-- CreateIndex
CREATE INDEX "LLMCache_createdAt_idx" ON "LLMCache"("createdAt");

-- CreateIndex
CREATE INDEX "SystemEvent_teamId_timestamp_idx" ON "SystemEvent"("teamId", "timestamp");

-- CreateIndex
CREATE INDEX "SystemEvent_name_idx" ON "SystemEvent"("name");

-- CreateIndex
CREATE INDEX "SystemEvent_teamId_name_idx" ON "SystemEvent"("teamId", "name");

-- CreateIndex
CREATE INDEX "SystemEvent_timestamp_idx" ON "SystemEvent"("timestamp");

-- CreateIndex
CREATE INDEX "SystemEvent_type_idx" ON "SystemEvent"("type");

-- CreateIndex
CREATE UNIQUE INDEX "KnowledgePerformance_knowledgeItemId_key" ON "KnowledgePerformance"("knowledgeItemId");

-- CreateIndex
CREATE UNIQUE INDEX "ImmutableAudit_eventId_key" ON "ImmutableAudit"("eventId");

-- CreateIndex
CREATE INDEX "ConversationEntry_leadId_idx" ON "ConversationEntry"("leadId");

-- CreateIndex
CREATE INDEX "ConversationEntry_conversationThreadId_idx" ON "ConversationEntry"("conversationThreadId");

-- CreateIndex
CREATE INDEX "ConversationThread_leadId_idx" ON "ConversationThread"("leadId");

-- CreateIndex
CREATE INDEX "ConversationThread_state_idx" ON "ConversationThread"("state");

-- CreateIndex
CREATE INDEX "WhatsAppMessage_leadId_idx" ON "WhatsAppMessage"("leadId");

-- CreateIndex
CREATE UNIQUE INDEX "MeetingCoordinationQueue_leadId_key" ON "MeetingCoordinationQueue"("leadId");

-- CreateIndex
CREATE INDEX "MeetingCoordinationQueue_assignedUserId_idx" ON "MeetingCoordinationQueue"("assignedUserId");

-- CreateIndex
CREATE INDEX "MeetingCoordinationQueue_status_idx" ON "MeetingCoordinationQueue"("status");

-- CreateIndex
CREATE UNIQUE INDEX "FeatureFlag_key_key" ON "FeatureFlag"("key");

-- CreateIndex
CREATE INDEX "ConsentLedger_leadId_idx" ON "ConsentLedger"("leadId");

-- CreateIndex
CREATE INDEX "ConsentLedger_channel_status_idx" ON "ConsentLedger"("channel", "status");

-- CreateIndex
CREATE UNIQUE INDEX "ContractProfile_teamId_key" ON "ContractProfile"("teamId");

-- CreateIndex
CREATE UNIQUE INDEX "TrainingDataset_version_key" ON "TrainingDataset"("version");

-- CreateIndex
CREATE INDEX "TrainingDataset_status_idx" ON "TrainingDataset"("status");

-- CreateIndex
CREATE INDEX "TrainingDataset_taskType_idx" ON "TrainingDataset"("taskType");

-- CreateIndex
CREATE INDEX "TrainingRecord_datasetId_idx" ON "TrainingRecord"("datasetId");

-- CreateIndex
CREATE INDEX "TrainingRecord_approved_idx" ON "TrainingRecord"("approved");

-- CreateIndex
CREATE INDEX "TrainingRecord_reviewScore_idx" ON "TrainingRecord"("reviewScore");

-- CreateIndex
CREATE INDEX "DatasetReview_datasetId_idx" ON "DatasetReview"("datasetId");

-- CreateIndex
CREATE INDEX "DatasetReview_reviewerId_idx" ON "DatasetReview"("reviewerId");

-- CreateIndex
CREATE UNIQUE INDEX "ModelVersion_version_key" ON "ModelVersion"("version");

-- CreateIndex
CREATE INDEX "ModelVersion_status_idx" ON "ModelVersion"("status");

-- CreateIndex
CREATE INDEX "ModelVersion_version_idx" ON "ModelVersion"("version");

-- CreateIndex
CREATE INDEX "EvaluationMetric_modelVersionId_idx" ON "EvaluationMetric"("modelVersionId");

-- CreateIndex
CREATE INDEX "EvaluationMetric_metricType_idx" ON "EvaluationMetric"("metricType");

-- CreateIndex
CREATE INDEX "EvaluationMetric_passed_idx" ON "EvaluationMetric"("passed");

-- CreateIndex
CREATE INDEX "ReplyTracker_status_idx" ON "ReplyTracker"("status");

-- CreateIndex
CREATE INDEX "ReplyTracker_leadId_idx" ON "ReplyTracker"("leadId");

-- CreateIndex
CREATE INDEX "ReplyTracker_aiClassification_idx" ON "ReplyTracker"("aiClassification");

-- CreateIndex
CREATE UNIQUE INDEX "CalendarEvent_newsletterId_key" ON "CalendarEvent"("newsletterId");

-- CreateIndex
CREATE UNIQUE INDEX "CalendarEvent_eventName_eventDate_key" ON "CalendarEvent"("eventName", "eventDate");

-- CreateIndex
CREATE INDEX "ShadowSignal_teamId_idx" ON "ShadowSignal"("teamId");

-- CreateIndex
CREATE INDEX "ShadowSignal_leadId_idx" ON "ShadowSignal"("leadId");

-- CreateIndex
CREATE INDEX "ShadowSignal_source_idx" ON "ShadowSignal"("source");

-- CreateIndex
CREATE INDEX "ShadowSignal_isWarmLead_idx" ON "ShadowSignal"("isWarmLead");

-- CreateIndex
CREATE INDEX "VectorDocument_type_idx" ON "VectorDocument"("type");

-- CreateIndex
CREATE INDEX "EngagementLog_email_idx" ON "EngagementLog"("email");

-- CreateIndex
CREATE INDEX "EngagementLog_event_idx" ON "EngagementLog"("event");

-- CreateIndex
CREATE INDEX "AuditLog_resource_idx" ON "AuditLog"("resource");

-- CreateIndex
CREATE INDEX "AuditLog_createdAt_idx" ON "AuditLog"("createdAt");

-- CreateIndex
CREATE INDEX "AuditLog_teamId_createdAt_idx" ON "AuditLog"("teamId", "createdAt");

-- CreateIndex
CREATE INDEX "Campaign_createdAt_idx" ON "Campaign"("createdAt");

-- CreateIndex
CREATE INDEX "Campaign_teamId_status_idx" ON "Campaign"("teamId", "status");

-- CreateIndex
CREATE INDEX "Email_status_idx" ON "Email"("status");

-- CreateIndex
CREATE INDEX "Email_createdAt_idx" ON "Email"("createdAt");

-- CreateIndex
CREATE INDEX "Email_openedAt_idx" ON "Email"("openedAt");

-- CreateIndex
CREATE INDEX "Email_clickedAt_idx" ON "Email"("clickedAt");

-- CreateIndex
CREATE UNIQUE INDEX "Job_idempotencyKey_key" ON "Job"("idempotencyKey");

-- CreateIndex
CREATE INDEX "Job_processAt_idx" ON "Job"("processAt");

-- CreateIndex
CREATE INDEX "Job_taskType_idx" ON "Job"("taskType");

-- CreateIndex
CREATE INDEX "Job_tenantId_idx" ON "Job"("tenantId");

-- CreateIndex
CREATE INDEX "Job_targetRuntime_idx" ON "Job"("targetRuntime");

-- CreateIndex
CREATE INDEX "Lead_email_idx" ON "Lead"("email");

-- CreateIndex
CREATE INDEX "Lead_company_idx" ON "Lead"("company");

-- CreateIndex
CREATE INDEX "Lead_status_idx" ON "Lead"("status");

-- CreateIndex
CREATE INDEX "Lead_intentScore_idx" ON "Lead"("intentScore");

-- CreateIndex
CREATE INDEX "Lead_leadScore_idx" ON "Lead"("leadScore");

-- CreateIndex
CREATE INDEX "Lead_pipelineState_idx" ON "Lead"("pipelineState");

-- CreateIndex
CREATE INDEX "Lead_teamId_status_idx" ON "Lead"("teamId", "status");

-- CreateIndex
CREATE INDEX "Lead_teamId_pipelineState_idx" ON "Lead"("teamId", "pipelineState");

-- CreateIndex
CREATE INDEX "Lead_teamId_email_idx" ON "Lead"("teamId", "email");

-- AddForeignKey
ALTER TABLE "Generation" ADD CONSTRAINT "Generation_leadId_fkey" FOREIGN KEY ("leadId") REFERENCES "Lead"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Task" ADD CONSTRAINT "Task_leadId_fkey" FOREIGN KEY ("leadId") REFERENCES "Lead"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Task" ADD CONSTRAINT "Task_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Task" ADD CONSTRAINT "Task_teamId_fkey" FOREIGN KEY ("teamId") REFERENCES "Team"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "JobRun" ADD CONSTRAINT "JobRun_jobId_fkey" FOREIGN KEY ("jobId") REFERENCES "Job"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ScrapingJob" ADD CONSTRAINT "ScrapingJob_teamId_fkey" FOREIGN KEY ("teamId") REFERENCES "Team"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CrmIntegration" ADD CONSTRAINT "CrmIntegration_teamId_fkey" FOREIGN KEY ("teamId") REFERENCES "Team"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SsoConfiguration" ADD CONSTRAINT "SsoConfiguration_teamId_fkey" FOREIGN KEY ("teamId") REFERENCES "Team"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WebhookLog" ADD CONSTRAINT "WebhookLog_webhookId_fkey" FOREIGN KEY ("webhookId") REFERENCES "Webhook"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AiTrace" ADD CONSTRAINT "AiTrace_runId_fkey" FOREIGN KEY ("runId") REFERENCES "WorkflowRun"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "KnowledgeBase" ADD CONSTRAINT "KnowledgeBase_teamId_fkey" FOREIGN KEY ("teamId") REFERENCES "Team"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "KnowledgeItem" ADD CONSTRAINT "KnowledgeItem_knowledgeBaseId_fkey" FOREIGN KEY ("knowledgeBaseId") REFERENCES "KnowledgeBase"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OrganizationPolicy" ADD CONSTRAINT "OrganizationPolicy_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Team"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserQuota" ADD CONSTRAINT "UserQuota_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserQuota" ADD CONSTRAINT "UserQuota_teamId_fkey" FOREIGN KEY ("teamId") REFERENCES "Team"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ApprovalRequest" ADD CONSTRAINT "ApprovalRequest_teamId_fkey" FOREIGN KEY ("teamId") REFERENCES "Team"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ApprovalRequest" ADD CONSTRAINT "ApprovalRequest_requesterId_fkey" FOREIGN KEY ("requesterId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ApprovalRequest" ADD CONSTRAINT "ApprovalRequest_reviewerId_fkey" FOREIGN KEY ("reviewerId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Playbook" ADD CONSTRAINT "Playbook_teamId_fkey" FOREIGN KEY ("teamId") REFERENCES "Team"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CaseStudy" ADD CONSTRAINT "CaseStudy_teamId_fkey" FOREIGN KEY ("teamId") REFERENCES "Team"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AgentTask" ADD CONSTRAINT "AgentTask_teamId_fkey" FOREIGN KEY ("teamId") REFERENCES "Team"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AgentTask" ADD CONSTRAINT "AgentTask_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AgentLog" ADD CONSTRAINT "AgentLog_taskId_fkey" FOREIGN KEY ("taskId") REFERENCES "AgentTask"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AgentFeedbackLoop" ADD CONSTRAINT "AgentFeedbackLoop_teamId_fkey" FOREIGN KEY ("teamId") REFERENCES "Team"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "KnowledgePerformance" ADD CONSTRAINT "KnowledgePerformance_knowledgeItemId_fkey" FOREIGN KEY ("knowledgeItemId") REFERENCES "KnowledgeItem"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Experiment" ADD CONSTRAINT "Experiment_teamId_fkey" FOREIGN KEY ("teamId") REFERENCES "Team"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ExperimentVariant" ADD CONSTRAINT "ExperimentVariant_experimentId_fkey" FOREIGN KEY ("experimentId") REFERENCES "Experiment"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ImmutableAudit" ADD CONSTRAINT "ImmutableAudit_teamId_fkey" FOREIGN KEY ("teamId") REFERENCES "Team"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ConversationEntry" ADD CONSTRAINT "ConversationEntry_leadId_fkey" FOREIGN KEY ("leadId") REFERENCES "Lead"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ConversationEntry" ADD CONSTRAINT "ConversationEntry_conversationThreadId_fkey" FOREIGN KEY ("conversationThreadId") REFERENCES "ConversationThread"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ConversationThread" ADD CONSTRAINT "ConversationThread_leadId_fkey" FOREIGN KEY ("leadId") REFERENCES "Lead"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WhatsAppMessage" ADD CONSTRAINT "WhatsAppMessage_leadId_fkey" FOREIGN KEY ("leadId") REFERENCES "Lead"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MeetingCoordinationQueue" ADD CONSTRAINT "MeetingCoordinationQueue_leadId_fkey" FOREIGN KEY ("leadId") REFERENCES "Lead"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MeetingCoordinationQueue" ADD CONSTRAINT "MeetingCoordinationQueue_assignedUserId_fkey" FOREIGN KEY ("assignedUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ConsentLedger" ADD CONSTRAINT "ConsentLedger_leadId_fkey" FOREIGN KEY ("leadId") REFERENCES "Lead"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ContractProfile" ADD CONSTRAINT "ContractProfile_teamId_fkey" FOREIGN KEY ("teamId") REFERENCES "Team"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TrainingRecord" ADD CONSTRAINT "TrainingRecord_datasetId_fkey" FOREIGN KEY ("datasetId") REFERENCES "TrainingDataset"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DatasetReview" ADD CONSTRAINT "DatasetReview_datasetId_fkey" FOREIGN KEY ("datasetId") REFERENCES "TrainingDataset"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DatasetReview" ADD CONSTRAINT "DatasetReview_reviewerId_fkey" FOREIGN KEY ("reviewerId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ModelVersion" ADD CONSTRAINT "ModelVersion_datasetId_fkey" FOREIGN KEY ("datasetId") REFERENCES "TrainingDataset"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EvaluationMetric" ADD CONSTRAINT "EvaluationMetric_modelVersionId_fkey" FOREIGN KEY ("modelVersionId") REFERENCES "ModelVersion"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ReplyTracker" ADD CONSTRAINT "ReplyTracker_leadId_fkey" FOREIGN KEY ("leadId") REFERENCES "Lead"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CalendarEvent" ADD CONSTRAINT "CalendarEvent_newsletterId_fkey" FOREIGN KEY ("newsletterId") REFERENCES "Newsletter"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ShadowSignal" ADD CONSTRAINT "ShadowSignal_leadId_fkey" FOREIGN KEY ("leadId") REFERENCES "Lead"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ShadowSignal" ADD CONSTRAINT "ShadowSignal_teamId_fkey" FOREIGN KEY ("teamId") REFERENCES "Team"("id") ON DELETE SET NULL ON UPDATE CASCADE;

