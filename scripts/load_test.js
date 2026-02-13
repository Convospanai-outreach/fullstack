import http from 'k6/http';
import { check, sleep } from 'k6';

export const options = {
  stages: [
    { duration: '30s', target: 50 }, // Ramp-up to 50 users
    { duration: '1m', target: 50 },  // Stay at 50 users
    { duration: '30s', target: 0 },  // Ramp-down
  ],
  thresholds: {
    http_req_duration: ['p(95)<2000'], // 95% of requests must complete below 2s
  },
};

const BASE_URL = __ENV.API_URL || 'http://localhost:3000';

export default function () {
  const teamId = 'test-team-id';
  
  // 1. Simulate Lead Ingestion (The heaviest hit)
  const payload = JSON.stringify({
    leads: Array.from({ length: 10 }).map((_, i) => ({
      email: `lead_${Math.random()}@example.com`,
      fullName: `Test Lead ${i}`,
      company: 'HighLoad Corp'
    }))
  });

  const params = {
    headers: {
      'Content-Type': 'application/json',
      'X-API-Key': __ENV.API_KEY || 'test-key'
    },
  };

  const res = http.post(`${BASE_URL}/api/leads/ingest`, payload, params);
  
  check(res, {
    'ingestion status is 200': (r) => r.status === 200,
  });

  // 2. Simulate Agent State Feedback
  const feedbackRes = http.post(`${BASE_URL}/api/agents/feedback`, JSON.stringify({
    generationId: 'test-gen-id',
    type: 'COPY'
  }), params);

  check(feedbackRes, {
    'feedback status is 200': (r) => r.status === 200,
  });

  sleep(1);
}
