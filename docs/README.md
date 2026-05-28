# CraftMyFunnel Documentation

This directory contains architecture notes, runbooks, implementation records, and operating guides for the CraftMyFunnel monorepo.

## Start Here

| Document | Purpose |
| --- | --- |
| [../README.md](../README.md) | GitHub landing page, service overview, local startup, deployment model |
| [../MASTER_SYSTEM_ARCHITECTURE.md](../MASTER_SYSTEM_ARCHITECTURE.md) | Current system architecture and deployment boundaries |
| [architecture-diagram.md](./architecture-diagram.md) | GitHub-renderable Mermaid architecture diagrams |
| [SIMPLE_REPO_TREE.md](./SIMPLE_REPO_TREE.md) | Repository structure and service map |
| [SETUP.md](./SETUP.md) | Setup and environment guidance |

## Architecture

| Document | Focus |
| --- | --- |
| [ARCHITECTURE.md](./ARCHITECTURE.md) | Broad product and technical architecture |
| [ARCHITECTURE_AI_AGENTIC_SYSTEM.md](./ARCHITECTURE_AI_AGENTIC_SYSTEM.md) | Agentic automation design notes |
| [MCP_ARCHITECTURE_MEMO.md](./MCP_ARCHITECTURE_MEMO.md) | Model Context Protocol integration architecture |
| [MCP_APP_LEARNINGS.md](./MCP_APP_LEARNINGS.md) | MCP tools for reading and sharing app learnings |
| [AI_GUARDRAILS_AND_TOKEN_USAGE.md](./AI_GUARDRAILS_AND_TOKEN_USAGE.md) | AI prompt guardrails, token logging, strict credit enforcement, and Mermaid/Merlin flow |
| [HARDENING_IMPLEMENTATION_STATUS_2026-04-25.md](./HARDENING_IMPLEMENTATION_STATUS_2026-04-25.md) | Completed hardening status across RBAC, billing, queueing, landing safety, and UI fixes |
| [SWARM_CRITIQUE_REPORT_2026-04-24.md](./SWARM_CRITIQUE_REPORT_2026-04-24.md) | Multi-agent review, adversarial critique, and prioritized remediation findings |
| [NETJANA_SIGNAL_INTEGRATION_PLAN.md](./NETJANA_SIGNAL_INTEGRATION_PLAN.md) | Netjana buyer-signal ingest, enrichment, and outreach flow |
| [landing-agent-architecture.md](./landing-agent-architecture.md) | Landing Agent funnel builder architecture |
| [landing-agent-discovery.md](./landing-agent-discovery.md) | Landing Agent insertion points and discovery notes |
| [data_model.md](./data_model.md) | Data-model reference |
| [DATABASE_SCHEMA_EXTENSIONS.md](./DATABASE_SCHEMA_EXTENSIONS.md) | Schema extension notes |

## API And Product References

| Document | Focus |
| --- | --- |
| [API_REFERENCE.md](./API_REFERENCE.md) | API reference |
| [landing-agent-api-examples.md](./landing-agent-api-examples.md) | Landing Agent API examples |
| [campaign_engine.md](./campaign_engine.md) | Campaign engine notes |
| [SOP_REPLY_DECISION_TREE.md](./SOP_REPLY_DECISION_TREE.md) | Reply handling operating procedure |
| [SOVEREIGN_NURTURE_WORKFLOW.md](./SOVEREIGN_NURTURE_WORKFLOW.md) | Sovereign nurture workflow |

## Operations And Deployment

| Document | Focus |
| --- | --- |
| [DEPLOYMENT_RUNBOOK.md](./DEPLOYMENT_RUNBOOK.md) | Deployment runbook |
| [RUNBOOK_ROLLBACK.md](./RUNBOOK_ROLLBACK.md) | Rollback procedure |
| [CI_VERIFICATION.md](./CI_VERIFICATION.md) | CI verification notes |
| [MONITORING.md](./MONITORING.md) | Monitoring guidance |
| [RATE_LIMITING.md](./RATE_LIMITING.md) | Rate limiting behavior |
| [BROWSER_SANDBOX.md](./BROWSER_SANDBOX.md) | Browser sandbox guidance |

## Planning, Audits, And Readiness

| Document | Focus |
| --- | --- |
| [IMPLEMENTATION_TRACKER.md](./IMPLEMENTATION_TRACKER.md) | Implementation tracker |
| [IMPLEMENTATION_SUMMARY.md](./IMPLEMENTATION_SUMMARY.md) | Implementation summary |
| [IMPLEMENTATION_AUDIT.md](./IMPLEMENTATION_AUDIT.md) | Implementation audit |
| [SCALABILITY_AUDIT.md](./SCALABILITY_AUDIT.md) | Scalability audit |
| [SCALE_READINESS.md](./SCALE_READINESS.md) | Scale readiness |
| [ENTERPRISE_PILOT.md](./ENTERPRISE_PILOT.md) | Enterprise pilot notes |
| [v1-beta-scope.md](./v1-beta-scope.md) | Beta scope |
| [beta_testing_plan.md](./beta_testing_plan.md) | Beta testing plan |

## Testing And QA

| Document | Focus |
| --- | --- |
| [MANUAL_TESTING_GUIDE.md](./MANUAL_TESTING_GUIDE.md) | Manual QA guide |
| [VISUAL_TESTING_CHECKLIST.md](./VISUAL_TESTING_CHECKLIST.md) | Visual testing checklist |
| [FAILURE_ANALYSIS.md](./FAILURE_ANALYSIS.md) | Failure analysis |
| [APP_FAILURE_MATRIX_2026-04-02.md](./APP_FAILURE_MATRIX_2026-04-02.md) | App failure matrix |

## Documentation Maintenance

When architecture, service boundaries, or startup behavior changes:

1. Update [../README.md](../README.md) for GitHub-facing summary changes.
2. Update [../MASTER_SYSTEM_ARCHITECTURE.md](../MASTER_SYSTEM_ARCHITECTURE.md) for system-level changes.
3. Update [architecture-diagram.md](./architecture-diagram.md) when runtime topology changes.
4. Update [SIMPLE_REPO_TREE.md](./SIMPLE_REPO_TREE.md) when folders or deployable services change.
5. Update hardening/audit docs when guardrails, RBAC, billing, or queue semantics change materially.
