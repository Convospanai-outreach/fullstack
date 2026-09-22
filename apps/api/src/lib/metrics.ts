import { register, Histogram, Counter, type HistogramConfiguration, type CounterConfiguration } from 'prom-client';

// Idempotent construction. This module is imported both by routes and (since the
// roadmap 2.10 latency histogram) on the server boot path, so a constructor that
// ran twice would throw prom-client's "already registered" error — fatal on boot.
// Reuse an already-registered metric instead of reconstructing it.
function histogram(config: HistogramConfiguration<string>): Histogram<string> {
    return (register.getSingleMetric(config.name) as Histogram<string> | undefined) ?? new Histogram(config);
}
function counter(config: CounterConfiguration<string>): Counter<string> {
    return (register.getSingleMetric(config.name) as Counter<string> | undefined) ?? new Counter(config);
}

export const microLLMLatency = histogram({
    name: 'micro_llm_latency_seconds',
    help: 'Latency of Micro-LLM requests',
    labelNames: ['task_type', 'status'],
    buckets: [0.1, 0.5, 1, 2, 5]
});

export const microLLMRequests = counter({
    name: 'micro_llm_requests_total',
    help: 'Total number of Micro-LLM requests',
    labelNames: ['task_type', 'status']
});

export const experimentExposure = counter({
    name: 'experiment_exposure_total',
    help: 'Total exposures for A/B experiments',
    labelNames: ['experiment_name', 'variant_name']
});

export const ragRetrievalLatency = histogram({
    name: 'rag_retrieval_latency_seconds',
    help: 'Latency of RAG retrieval operations',
    buckets: [0.1, 0.5, 1, 2]
});

// Per-request HTTP latency, recorded by the Fastify onResponse hook (server.ts).
// `route` is the matched route pattern (e.g. /leads/:id), never the raw URL, to
// keep label cardinality bounded.
export const httpRequestDuration = histogram({
    name: 'http_request_duration_seconds',
    help: 'Latency of HTTP requests handled by the Fastify API',
    labelNames: ['method', 'route', 'status_code'],
    buckets: [0.05, 0.1, 0.25, 0.5, 1, 2, 5, 10]
});

export async function getMetrics() {
    return register.metrics();
}
