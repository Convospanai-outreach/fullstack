
import { prisma } from './db-seed';
import { hash } from 'bcryptjs';

async function main() {
    const email = 'audit_user@example.com';
    const password = 'AuditPassword123!';

    console.log(`Checking for user: ${email}...`);

    let user = await prisma.user.findUnique({ where: { email } });

    if (user) {
        console.log('User exists. Updating password to be sure...');
        const hashedPassword = await hash(password, 12);
        await prisma.user.update({
            where: { email },
            data: { password: hashedPassword }
        });
        console.log('Password updated.');
    } else {
        console.log('User does not exist. Creating...');
        const hashedPassword = await hash(password, 12);
        user = await prisma.user.create({
            data: {
                name: 'Audit User',
                email,
                password: hashedPassword,
                role: 'USER',
            }
        });
        console.log('User created:', user.id);
    }

    // Ensure team membership
    const membership = await prisma.teamMember.findFirst({ where: { userId: user.id } });
    if (!membership) {
        console.log('Creating default team...');
        await prisma.team.create({
            data: {
                name: "Audit Team",
                members: {
                    create: {
                        userId: user.id,
                        email: user.email,
                        role: 'owner'
                    }
                }
            }
        });
    }

    console.log('Setup complete.');
}

main()
    .catch(console.error)
    .finally(() => prisma.$disconnect());
