const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient({
    datasources: {
        db: {
            url: 'postgresql://postgres:postgres@localhost:5433/convospan'
        }
    }
});

async function fix() {
    try {
        console.log("🛠 Starting manual schema fix...");
        await prisma.$executeRawUnsafe('ALTER TABLE "KnowledgeItem" ADD COLUMN IF NOT EXISTS version INTEGER DEFAULT 1;');
        await prisma.$executeRawUnsafe('ALTER TABLE "AutomationLog" ADD COLUMN IF NOT EXISTS input TEXT;');
        await prisma.$executeRawUnsafe('ALTER TABLE "AutomationLog" ADD COLUMN IF NOT EXISTS metadata JSONB;');
        console.log('✅ Schema fixed manually via Prisma.');
    } catch (e) {
        console.error('❌ Fix failed:', e);
    } finally {
        await prisma.$disconnect();
    }
}

fix();
