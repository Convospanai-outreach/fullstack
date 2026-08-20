process.env.DATABASE_URL = 'postgresql://user:pass@localhost:5432/devdb';

try {
  console.log('Step 1: Importing PrismaClient...');
  const { PrismaClient } = require('@prisma/client');
  console.log('Step 2: PrismaClient imported, type:', typeof PrismaClient);
  
  console.log('Step 3: Instantiating...');
  const prisma = new PrismaClient({
    datasources: {
      db: {
        url: process.env.DATABASE_URL
      }
    }
  });
  console.log('Step 4: ✓ Instantiated successfully');
  
  console.log('Step 5: Disconnecting...');
  prisma.$disconnect().then(() => {
    console.log('Step 6: ✓ Disconnected');
  }).catch(err => {
    console.error('Disconnect error:', err);
  });
} catch (err) {
  console.error('✗ Error:', err.message);
  console.error('Stack:', err.stack);
}
