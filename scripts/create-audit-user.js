const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcryptjs');

const prisma = new PrismaClient();

async function main() {
    const email = 'audit_user@example.com';
    const password = 'AuditPassword123!';
    const hashedPassword = await bcrypt.hash(password, 10);
    
    await prisma.user.upsert({
        where: { email },
        update: { password: hashedPassword },
        create: {
            email,
            password: hashedPassword,
            name: 'Audit User',
            role: 'admin', // assuming role might be required or useful
        },
    });
    console.log('Audit user seeded successfully!');
}

main().catch(console.error).finally(() => prisma.$disconnect());
