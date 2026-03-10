
import { 
  checkRateLimit, 
  resetRateLimit, 
  clearAllRateLimits 
} from '../src/lib/rateLimit';

async function verify() {
    console.log('🧪 Verifying Rate Limit Service...');

    // Clean slate
    await clearAllRateLimits();

    // Test 1: Basic Allow within limit
    const config = { windowMs: 1000, maxRequests: 3 };
    const id = 'test:verify';

    let allowedCalls = 0;
    for(let i=0; i<3; i++) {
        const res = await checkRateLimit(id, config, 'test');
        if(res.allowed) allowedCalls++;
    }

    if(allowedCalls === 3) {
        console.log('✅ 1. Basic Allow: PASSED');
    } else {
        console.error('❌ 1. Basic Allow: FAILED');
    }

    // Test 2: Block when exceeded
    const blockedRes = await checkRateLimit(id, config, 'test');
    if(!blockedRes.allowed) {
        console.log('✅ 2. Blocking: PASSED');
    } else {
        console.error('❌ 2. Blocking: FAILED');
    }

    // Test 3: Admin Reset
    await resetRateLimit(id, 'test');
    const resetRes = await checkRateLimit(id, config, 'test');
    if(resetRes.allowed) {
        console.log('✅ 3. Admin Reset: PASSED');
    } else {
        console.error('❌ 3. Admin Reset: FAILED');
    }

    console.log('✨ Verification Complete');
}

verify().catch(console.error);
