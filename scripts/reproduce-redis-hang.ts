
import { getRedisClient } from '../src/lib/redis';

async function main() {
    console.log('1. Calling getRedisClient()...');
    const client = await getRedisClient();

    console.log('2. Client retrieved. isOpen:', client?.isOpen);

    if (client) {
        console.log('3. Attempting client.get("foo")... (If this hangs, hypothesis is confirmed)');

        // This should hang if client is not open and queueing is enabled (default)
        const promise = client.get('foo');

        // race against a timeout
        const timeout = new Promise((_, reject) => setTimeout(() => reject('TIMEOUT'), 3000));

        try {
            const result = await Promise.race([promise, timeout]);
            console.log('4. Result:', result);
        } catch (e) {
            console.log('4. Caught error (or timeout):', e);
        }
    }

    process.exit(0);
}

main().catch(console.error);
