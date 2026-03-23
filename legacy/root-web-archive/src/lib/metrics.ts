import { register, Histogram, Counter } from 'prom-client';

// Singleton registry to avoid duplicate metrics in HMR
const globalRegistry = globalThis as unknown as { __METRICS_REGISTRY_INITIALIZED__?: boolean };

if (!globalRegistry.__METRICS_REGISTRY_INITIALIZED__) {
    // Default metrics (gc, usage, etc.)
    // We avoid collecting default metrics in valid edge/serverless runtimes usually, 
    // but for a long-running nextjs server it's fine.
    // However, Next.js api routes might re-initialize. 
    // We'll stick to custom metrics for stability.
    globalRegistry.__METRICS_REGISTRY_INITIALIZED__ = true;
}

export const microLLMLatency = new Histogram({
    name: 'micro_llm_latency_seconds',
    help: 'Latency of Micro-LLM requests',
    labelNames: ['task_type', 'status'],
    buckets: [0.1, 0.5, 1, 2, 5]
});

export const microLLMRequests = new Counter({
    name: 'micro_llm_requests_total',
    help: 'Total number of Micro-LLM requests',
    labelNames: ['task_type', 'status']
});

export const experimentExposure = new Counter({
    name: 'experiment_exposure_total',
    help: 'Total exposures for A/B experiments',
    labelNames: ['experiment_name', 'variant_name']
});

export const ragRetrievalLatency = new Histogram({
    name: 'rag_retrieval_latency_seconds',
    help: 'Latency of RAG retrieval operations',
    buckets: [0.1, 0.5, 1, 2]
});

export async function getMetrics() {
    return register.metrics();
}
