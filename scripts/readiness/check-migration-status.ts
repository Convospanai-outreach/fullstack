import * as dotenv from 'dotenv';
import { prisma } from '../../apps/web/src/lib/db';

dotenv.config();

async function main() {
  const dbUrl = process.env.DATABASE_URL;
  if (!dbUrl) {
    console.error('ERROR: DATABASE_URL is not set in env.');
    process.exit(1);
  }

  // Determine if remote/production database is being targeted
  const isLocal = dbUrl.includes('localhost') || dbUrl.includes('127.0.0.1') || dbUrl.includes('devdb');
  const allowProd = process.argv.includes('--allow-production-readonly');

  if (!isLocal) {
    console.log('WARNING: Remote/Production database connection detected.');
    if (!allowProd) {
      console.error(
        'ERROR: Requires explicit confirmation flag to run read-only check against remote DB.\n' +
        'Please run with: npx tsx scripts/readiness/check-migration-status.ts --allow-production-readonly'
      );
      process.exit(1);
    }
    console.log('Explicit production confirmation flag active. Starting read-only checks...');
  } else {
    console.log('Starting read-only checks against local database...');
  }

  // Never print or leak secrets/env values
  console.log('Connection checks initialized. Environment status: OK');



  try {
    // 1. Fetch tables list to verify if migration table exists
    const tablesResult = await prisma.$queryRawUnsafe<{ table_name: string }[]>(
      `SELECT table_name FROM information_schema.tables WHERE table_schema = 'public'`
    );

    const hasMigrationTable = tablesResult.some((t) => t.table_name === '_prisma_migrations');

    if (!hasMigrationTable) {
      console.log('STATUS: FAIL - _prisma_migrations table does not exist. No migrations applied.');
      process.exit(0);
    }

    // 2. Fetch applied migrations
    const migrations = await prisma.$queryRawUnsafe<{
      id: string;
      migration_name: string;
      finished_at: string;
      applied_steps_count: number;
    }[]>(
      `SELECT id, migration_name, finished_at, applied_steps_count 
       FROM _prisma_migrations 
       ORDER BY started_at ASC`
    );

    console.log('\n--- Applied Migrations Metadata ---');
    if (migrations.length === 0) {
      console.log('No records found in _prisma_migrations.');
    } else {
      for (const m of migrations) {
        console.log(
          `Migration: ${m.migration_name}\n` +
          `  Status: Finished at ${m.finished_at}\n` +
          `  Steps: ${m.applied_steps_count}\n`
        );
      }
    }

    console.log('STATUS: PASS - Migration status metadata retrieved successfully.');
  } catch (error) {
    console.error('ERROR executing query:', error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((err) => {
  console.error('Fatal execution error:', err);
  process.exit(1);
});
