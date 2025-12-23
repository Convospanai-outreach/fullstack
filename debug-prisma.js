const { PrismaClient } = require('@prisma/client');

console.log('PRISMA_CLIENT_ENGINE_TYPE:', process.env.PRISMA_CLIENT_ENGINE_TYPE);
console.log('PRISMA_CLI_QUERY_ENGINE_TYPE:', process.env.PRISMA_CLI_QUERY_ENGINE_TYPE);
console.log('NODE_ENV:', process.env.NODE_ENV);

try {
  const prisma = new PrismaClient();
  console.log('Prisma initialized successfully');
} catch (e) {
  console.error('Prisma initialization failed:', e.message);
}
