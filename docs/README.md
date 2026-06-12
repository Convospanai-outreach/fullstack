# CraftMyFunnel Documentation

This folder holds the current architecture, readiness, deployment, QA, and implementation docs for the CraftMyFunnel monorepo.

## Start Here

| Document | Why it matters |
| --- | --- |
| [../README.md](../README.md) | Repo overview, current status, local commands, deployment model |
| [../MASTER_SYSTEM_ARCHITECTURE.md](../MASTER_SYSTEM_ARCHITECTURE.md) | Current service boundaries and runtime topology |
| [ARCHITECTURE.md](./ARCHITECTURE.md) | Practical architecture summary for the current repo |
| [PRODUCTION_READINESS_ASSESSMENT_2026-06-02.md](./PRODUCTION_READINESS_ASSESSMENT_2026-06-02.md) | Most recent evidence-based readiness assessment |
| [context/ARCHITECTURE.md](./context/ARCHITECTURE.md) | Short internal wiki version of the architecture |
| [context/LAUNCH_READINESS.md](./context/LAUNCH_READINESS.md) | Short internal wiki version of launch checks and blockers |

## Architecture And Runtime

| Document | Focus |
| --- | --- |
| [architecture-diagram.md](./architecture-diagram.md) | Mermaid diagrams |
| [MCP_ARCHITECTURE_MEMO.md](./MCP_ARCHITECTURE_MEMO.md) | MCP-specific notes |
| [landing-agent-architecture.md](./landing-agent-architecture.md) | Landing Agent flow and boundaries |
| [deployment/multi-region-architecture.md](./deployment/multi-region-architecture.md) | Multi-region design notes |

## Operations And Release

| Document | Focus |
| --- | --- |
| [DEPLOYMENT_RUNBOOK.md](./DEPLOYMENT_RUNBOOK.md) | Deployment runbook |
| [CI_VERIFICATION.md](./CI_VERIFICATION.md) | CI verification notes |
| [MONITORING.md](./MONITORING.md) | Monitoring guidance |
| [SCALE_READINESS.md](./SCALE_READINESS.md) | Scale readiness and gaps |

## Assessments And Audits

| Document | Focus |
| --- | --- |
| [PRODUCTION_READINESS_ASSESSMENT_2026-05-29.md](./PRODUCTION_READINESS_ASSESSMENT_2026-05-29.md) | Earlier readiness snapshot |
| [PRODUCTION_READINESS_ASSESSMENT_2026-06-02.md](./PRODUCTION_READINESS_ASSESSMENT_2026-06-02.md) | Current readiness snapshot |
| [HARDENING_IMPLEMENTATION_STATUS_2026-04-25.md](./HARDENING_IMPLEMENTATION_STATUS_2026-04-25.md) | Security hardening record |
| [SWARM_CRITIQUE_REPORT_2026-04-24.md](./SWARM_CRITIQUE_REPORT_2026-04-24.md) | Review findings and remediation themes |

## Documentation Maintenance Rules

When the product shape or readiness story changes, update these together:

1. `README.md`
2. `MASTER_SYSTEM_ARCHITECTURE.md`
3. `docs/ARCHITECTURE.md`
4. `docs/context/ARCHITECTURE.md`
5. `docs/context/LAUNCH_READINESS.md`
6. the latest readiness assessment file

If an older doc describes a topology or workflow that no longer exists, either update it immediately or clearly mark it as historical/planning-only. Quiet doc drift is treated as a product risk, not just a docs issue.
