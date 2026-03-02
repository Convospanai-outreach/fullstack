## 🔴 Critical "Fuckups" & Fake Implementations (House of Cards)
| Component | Status | Finding | Risk |
|-----------|--------|---------|------|
| **Zero-Knowledge Vault** | `Vault.ts` | Uses `atob`/`btoa` (Base64) as "sealed" encryption. NO real crypto used. | **CRITICAL**: Credentials are effectively plaintext. |
| **PII Restoration** | `HardwareService.ts` | `reIdentify` mimics restoration by splitting strings and appending `@example.com`. | **CRITICAL**: The "Sovereign Enclave" isn't actually storing/restoring data. |
| **AI Embeddings** | `aiService.ts` | If Gemini ID is missing, it generates **sine-wave hashes** as fake embeddings. | **High**: Semantic search/RAG will return random garbage while appearing functional. |
| **ML Fine-Tuning** | `TrainingManager.ts` | Uses a 5-second `setTimeout` to simulate hours of training. No actual fine-tuning happens. | **Medium**: The "Proprietary Models" are just standard Gemini/GPT. |
| **Data Residency** | `DbFactory.ts` | Falls back to GLOBAL database if `UAE_DATABASE_URL` is missing. | **Compliance**: Violates UAE data sovereignty laws silently. |

## 🟡 Half-Implemented / Placeholder Features
| Feature | File | Finding |
|---------|------|---------|
| **Proprietary Index** | `DataIngestionService.ts` | Hardcoded JSON object in source code instead of a managed database. |
| **RAG Signaling** | `BullsEyeRAG.ts` | Brittle computer-use logic using hardcoded CSS selectors (`#crm-tab`). |
| **Sequence Automation** | `sequenceHandlers.ts` | `CONNECT` uses mock context; `MESSAGE` uses hardcoded "Just checking in!". |
| **Sovereign Firewall** | `SovereignFirewall.ts` | `critique` contains a `DEV_BYPASS` that returns a 1.0 (perfect) score. |

## 🟢 Technical Debt & Smells
| Type | Location | Description |
|------|----------|-------------|
| **Mock Bloat** | `src/data/mockDashboard.ts` | Used to populate main analytics view instead of real aggregates. |
| **Console Sprawl** | `IdentityService.ts` | Extensive `console.log` for access requests, lacking structured logging. |
| **Wait Watchdog** | `scraper-bridge` | Many manual `delay` and `waitForTimeout` calls in LinkedIn logic. |

