const { PrismaClient } = require('@prisma/client');

console.log('Importing Prisma client...');
try {
  const prisma = new PrismaClient();
  console.log('✓ PrismaClient instantiated successfully');
  prisma.$disconnect().then(() => {
    console.log('✓ Prisma connection closed');
    process.exit(0);
  }).catch(err => {
    console.error('Error disconnecting:', err.message);
    process.exit(1);
  });
} catch (err) {
  console.error('✗ Error instantiating Prisma:', err.message);
  process.exit(1);
}
