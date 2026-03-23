import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function main() {
  const existing = await prisma.user.findUnique({
    where: { email: 'test@test.com' },
  });

  if (!existing) {
    await prisma.user.create({
      data: {
        email: 'test@test.com',
        name: 'Test Admin',
        role: 'admin',
        // Note: In production, you should hash passwords!
        // For local testing, we can store plain text.
        // You can later integrate bcrypt if you add a password field to schema.
      },
    });
    console.log('✅ Test admin user created successfully!');
  } else {
    console.log('⚠️ Test admin user already exists.');
  }
}

main()
  .catch((e) => console.error(e))
  .finally(() => prisma.$disconnect());
