-- Migration: 001_initial_schema
-- Description: CraftMyFunnel Autonomous Engine Schema - Multi-tenant, PII Separation, Intelligence Domains
-- Dialect: PostgreSQL

-- ============================================================
-- EXTENSIONS & ENUMS
-- ============================================================
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";
CREATE EXTENSION IF NOT EXISTS "vector"; -- for pgvector embeddings

CREATE TYPE contact_method_type AS ENUM ('email', 'phone', 'linkedin', 'other');
CREATE TYPE campaign_status AS ENUM ('draft', 'active', 'paused', 'completed', 'archived');
CREATE TYPE drift_severity AS ENUM ('low', 'medium', 'high', 'critical');

-- ============================================================
-- TENANT DOMAIN
-- Enables multi-tenant enterprise isolation
-- ============================================================
CREATE TABLE tenants (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name TEXT NOT NULL,
    industry TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
ALTER TABLE tenants ENABLE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation_policy ON tenants 
    USING (id = current_setting('app.current_tenant_id', true)::uuid);

-- ============================================================
-- IDENTITY & PII DOMAIN
-- Strictly separated to ensure sovereign compliance.
-- Encrypted at rest. Never sent to cloud LLM.
-- ============================================================
CREATE TABLE companies (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    domain TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
ALTER TABLE companies ENABLE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation_policy ON companies USING (tenant_id = current_setting('app.current_tenant_id', true)::uuid);

CREATE TABLE leads (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    company_id UUID REFERENCES companies(id) ON DELETE SET NULL,
    -- Deterministic hash used to link to Intelligence Domain without exposing PII
    lead_hash_id TEXT NOT NULL UNIQUE, 
    first_name_encrypted BYTEA NOT NULL,
    last_name_encrypted BYTEA NOT NULL,
    title TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
ALTER TABLE leads ENABLE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation_policy ON leads USING (tenant_id = current_setting('app.current_tenant_id', true)::uuid);

CREATE TABLE contact_methods (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    lead_id UUID NOT NULL REFERENCES leads(id) ON DELETE CASCADE,
    method_type contact_method_type NOT NULL,
    value_encrypted BYTEA NOT NULL, -- Encrypted email/phone/etc
    is_primary BOOLEAN NOT NULL DEFAULT false,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
ALTER TABLE contact_methods ENABLE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation_policy ON contact_methods USING (tenant_id = current_setting('app.current_tenant_id', true)::uuid);

-- ============================================================
-- CAMPAIGN & PLAYBOOK DOMAIN
-- ============================================================
CREATE TABLE playbooks (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    description TEXT,
    steps JSONB NOT NULL DEFAULT '[]', -- Execution steps / nodes
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
ALTER TABLE playbooks ENABLE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation_policy ON playbooks USING (tenant_id = current_setting('app.current_tenant_id', true)::uuid);

CREATE TABLE campaigns (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    playbook_id UUID REFERENCES playbooks(id) ON DELETE SET NULL,
    name TEXT NOT NULL,
    status campaign_status NOT NULL DEFAULT 'draft',
    start_date TIMESTAMPTZ,
    end_date TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
ALTER TABLE campaigns ENABLE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation_policy ON campaigns USING (tenant_id = current_setting('app.current_tenant_id', true)::uuid);

-- ============================================================
-- INTELLIGENCE DOMAIN
-- No relations to `leads` table. Uses `lead_hash_id` only.
-- Entirely PII-free. Safe for Cloud LLM processing (Gemini).
-- ============================================================
CREATE TABLE lead_intelligence (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    lead_hash_id TEXT NOT NULL, -- Reference to leads.lead_hash_id, loose coupling
    sentiment_score NUMERIC(3, 2), -- Range: -1.00 to 1.00
    engagement_level TEXT,
    summary_anonymized TEXT, -- Generated by Local Micro-LLM before hitting Cloud
    next_best_action TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
ALTER TABLE lead_intelligence ENABLE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation_policy ON lead_intelligence USING (tenant_id = current_setting('app.current_tenant_id', true)::uuid);

CREATE TABLE objection_clusters (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    cluster_name TEXT NOT NULL,
    description TEXT,
    embedding vector(768), -- pgvector for similarity search on historical objections
    resolution_playbook_id UUID REFERENCES playbooks(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
ALTER TABLE objection_clusters ENABLE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation_policy ON objection_clusters USING (tenant_id = current_setting('app.current_tenant_id', true)::uuid);

-- Index for scalable vector similarity search (HNSW)
CREATE INDEX ON objection_clusters USING hnsw (embedding vector_cosine_ops);

CREATE TABLE performance_snapshots (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    metric_name TEXT NOT NULL,
    metric_value NUMERIC NOT NULL,
    dimensions JSONB NOT NULL DEFAULT '{}',
    recorded_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
ALTER TABLE performance_snapshots ENABLE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation_policy ON performance_snapshots USING (tenant_id = current_setting('app.current_tenant_id', true)::uuid);

-- ============================================================
-- GOVERNANCE & AUDIT DOMAIN
-- Tracks AI autonomous actions and model health 
-- ============================================================
CREATE TABLE model_decision_logs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    agent_id UUID, 
    lead_hash_id TEXT NOT NULL,
    prompt_version TEXT NOT NULL,
    input_hash TEXT NOT NULL, -- Hash of the payload sent to the model
    output_hash TEXT NOT NULL, -- Hash of the model's response
    decision_reasoning TEXT,
    llm_tier TEXT, -- Edge vs Cloud
    decided_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
ALTER TABLE model_decision_logs ENABLE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation_policy ON model_decision_logs USING (tenant_id = current_setting('app.current_tenant_id', true)::uuid);

CREATE TABLE drift_events (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    model_name TEXT NOT NULL,
    metric_name TEXT NOT NULL,
    expected_value NUMERIC NOT NULL,
    actual_value NUMERIC NOT NULL,
    severity drift_severity NOT NULL DEFAULT 'low',
    detected_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    resolved_at TIMESTAMPTZ
);
ALTER TABLE drift_events ENABLE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation_policy ON drift_events USING (tenant_id = current_setting('app.current_tenant_id', true)::uuid);
