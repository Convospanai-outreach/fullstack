import { UserRole } from '@prisma/client';
import { hash } from 'bcryptjs';
import { prisma } from '../src/lib/db';

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
            status: 'active',
          },
        },
      },
    });
    console.log('Team created.');
  } else {
    await prisma.teamMember.updateMany({
      where: {
        teamId: team.id,
        userId: user.id,
      },
      data: {
        status: 'active',
      },
    });
    console.log('Team membership activated.');
  }
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  });
