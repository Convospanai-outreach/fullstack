
import { prisma } from '../src/lib/db';
import * as bcrypt from 'bcryptjs';

async function setupAuditUser() {
    const email = 'audit_user@example.com';
    const password = 'AuditPassword123!';
    const hashedPassword = await bcrypt.hash(password, 10);

    const user = await prisma.user.upsert({
        where: { email },
        update: { password: hashedPassword },
        create: {
            email,
            password: hashedPassword,
            name: 'Audit User',
            emailVerified: new Date(),
        },
    });

    console.log(`Audit user ensured: ${user.email}`);

    // Ensure team
    const team = await prisma.team.upsert({
        where: { id: 'audit-team-id' },
        update: {},
        create: {
            id: 'audit-team-id',
            name: 'Audit Team',
        }
    });

    // Link user to team
    const membership = await prisma.teamMember.findFirst({
        where: { teamId: team.id, userId: user.id }
    });

    if (!membership) {
        await prisma.teamMember.create({
            data: {
                teamId: team.id,
                userId: user.id,
                email: user.email,
                role: 'OWNER',
                status: 'active'
            }
        });
    }

    console.log(`User linked to team: ${team.name}`);
}

setupAuditUser()
    .catch(console.error)
    .finally(() => prisma.$disconnect());
