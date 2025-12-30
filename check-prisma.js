const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function check() {
    console.log('Prisma models:', Object.keys(prisma).filter(k => !k.startsWith('_') && typeof prisma[k] === 'object' && prisma[k] !== null));
    process.exit(0);
}

check();
