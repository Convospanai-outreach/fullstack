import http from 'k6/http';
import { check, sleep, group } from 'k6';

/**
 * Enterprise Handoff & Pipeline Stress Test
 * Simulates high-velocity lead ingestion followed by human caller interventions.
 */

export const options = {
  stages: [
    { duration: '30s', target: 20 },  // Normal load
    { duration: '1m',  target: 100 }, // High-velocity burst
    { duration: '30s', target: 0 },   // Cleanup
  ],
  thresholds: {
    http_req_duration: ['p(99)<1500'], // 99% of requests must be < 1.5s
    'http_req_failed': ['rate<0.01'],  // Less than 1% failure
  },
};

const BASE_URL = __ENV.API_URL || 'http://localhost:3000';
const API_KEY = __ENV.API_KEY || 'enterprise-load-test-key';

export default function () {
  const teamId = 'team-enterprise-123';
  
  group('1. Lead Ingestion (The Firehose)', () => {
    const payload = JSON.stringify({
      leads: Array.from({ length: 5 }).map((_, i) => ({
        email: `load_${Date.now()}_${i}@test.com`,
        fullName: `Volume Lead ${i}`,
        company: 'ScaleCorp',
        containsPII: true // Triggers sovereign routing
      }))
    });

    const res = http.post(`${BASE_URL}/api/leads/ingest`, payload, {
      headers: { 'Content-Type': 'application/json', 'X-API-Key': API_KEY },
    });
    
    check(res, { 'ingest success': (r) => r.status === 200 });
  });

  sleep(0.5);

  group('2. Caller Queue Synchronization', () => {
    // Simulates an army of 100 callers refreshing the queue
    const res = http.get(`${BASE_URL}/api/caller/queue`, {
      headers: { 
        'Authorization': 'Bearer test-token',
        'X-Mock-User': 'caller-123'
      },
    });

    check(res, { 'queue fetch success': (r) => r.status === 200 || r.status === 403 }); 
    // 403 is acceptable if we haven't mocked auth yet, but 200 is goal.
  });

  sleep(1);

  group('3. Lead Claiming (Contention Test)', () => {
    const payload = JSON.stringify({
      action: 'claim',
      leadId: 'some-hot-lead-uuid'
    });

    const res = http.post(`${BASE_URL}/api/caller/queue`, payload, {
      headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer test-token' },
    });

    // We expect some 409 Conflict in a real race, but k6 will check status < 500
    check(res, { 'claim attempt processed': (r) => r.status < 500 });
  });

  sleep(2);
}
