
import { AuditService } from '../src/modules/audit/auditService';
import { prisma } from '../src/lib/db';

async function main() {
    console.log('1. Attempting AuditService.log...');

    // set a timeout to detect hang
    const timeout = new Promise((_, reject) => setTimeout(() => reject('TIMEOUT'), 5000));

    const logPromise = AuditService.log(
        "test-org",
        null, // system
        "TEST_ACTION",
        "TestResource",
        "123",
        { foo: "bar" }
    );

    try {
        await Promise.race([logPromise, timeout]);
        console.log('2. AuditService.log completed successfully.');
    } catch (e) {
        console.error('2. Failed or Timed Out:', e);
    }
}

main()
    .catch(console.error)
    .finally(() => prisma.$disconnect());
