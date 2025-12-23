import { canRunAgent, deductCredits } from './src/services/billing/creditService';

// Example Usage
async function agentRunner(userId: string) {
    const AGENT_COST = 5;

    try {
        // 1. Fail fast if insufficient balance
        const allowed = await canRunAgent(userId, AGENT_COST);
        if (!allowed) {
            console.log('Blocked: Insufficient credits');
            return;
        }

        console.log('Running agent task...');
        // ... run actual agent logic here ...

        // 2. Deduct credits atomically after (or before) execution
        await deductCredits(userId, AGENT_COST, 'Agent Task Execution');
        console.log('Credits deducted successfully');

    } catch (error) {
        if (error.message === 'Insufficient credits') {
            console.log('Transaction aborted: User ran out of credits mid-process');
        } else {
            console.error('System Error:', error);
        }
    }
}
