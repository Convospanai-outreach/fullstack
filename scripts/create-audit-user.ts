
import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
    const email = 'audit_user@example.com';
    const password = 'AuditPassword123!';
    const hashedPassword = await bcrypt.hash(password, 10);

    const user = await prisma.user.upsert({
        where: { email },
        update: {
            password: hashedPassword,
            emailVerified: new Date(),
        },
        create: {
            email,
            name: 'Audit User',
            password: hashedPassword,
            emailVerified: new Date(),
            role: 'USER', // Adjust if you have specific enums like 'ADMIN' or 'ENTERPRISE'
        },
    });

    console.log(`User ${user.email} upserted successfully.`);
}

main()
    .catch((e) => {
        console.error(e);
        process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect();
    });
