import { PrismaClient, UserRole } from '@prisma/client';
import { hash } from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
  const email = 'audit_user@example.com';
  const password = 'AuditPassword123!';
  const hashedPassword = await hash(password, 12);

  const user = await prisma.user.upsert({
    where: { email },
    update: {
      password: hashedPassword,
      enterpriseRole: UserRole.ORG_ADMIN,
    },
    create: {
      email,
      name: 'Audit User',
      password: hashedPassword,
      role: 'admin',
      enterpriseRole: UserRole.ORG_ADMIN,
    },
  });

  console.log(`User created/updated: ${user.email}`);

  const team = await prisma.team.findFirst({
    where: { members: { some: { userId: user.id } } },
  });

  if (!team) {
    console.log('Creating team for user...');
    await prisma.team.create({
      data: {
        name: 'Audit Team',
        members: {
          create: {
            userId: user.id,
            email: user.email,
            role: 'owner',
          },
        },
      },
    });
    console.log('Team created.');
  }
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
