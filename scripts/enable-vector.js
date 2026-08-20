const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
    try {
        await prisma.$executeRawUnsafe('CREATE EXTENSION IF NOT EXISTS vector;');
        console.log('Extension "vector" created or already exists.');
    } catch (error) {
        console.error('Failed to create extension:', error);
    } finally {
        await prisma.$disconnect();
    }
}

main();
