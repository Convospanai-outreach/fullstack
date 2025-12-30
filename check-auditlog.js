const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function check() {
    try {
        await prisma.auditLog.create({
            data: {
                action: 'TEST',
                entity: 'TEST',
                orgId: 'some-id',
                actorId: 'some-id'
            }
        });
    } catch (e) {
        console.log('Create error (expected):', e.message);
    }
    process.exit(0);
}

check();
