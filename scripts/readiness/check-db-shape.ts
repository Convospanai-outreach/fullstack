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
        'Please run with: npx tsx scripts/readiness/check-db-shape.ts --allow-production-readonly'
      );
      process.exit(1);
    }
    console.log('Explicit production confirmation flag active. Starting read-only checks...');
  } else {
    console.log('Starting read-only checks against local database...');
  }

  // Never print or leak secrets/env values
  console.log('Connection checks initialized. Environment status: OK');



  let pass = true;

  try {
    // 1. Fetch all public tables in database
    const tablesResult = await prisma.$queryRawUnsafe<{ table_name: string }[]>(
      `SELECT table_name FROM information_schema.tables WHERE table_schema = 'public'`
    );

    const actualTables = new Set(tablesResult.map((t) => t.table_name));

    console.log('\n--- Table Verification List ---');
    const expectedTables = [
      'User',
      'Team',
      'TeamMember',
      'ConnectedMailbox',
      'Email',
      'Campaign',
      'Workflow',
    ];

    for (const table of expectedTables) {
      const exists = actualTables.has(table);
      console.log(`Table "${table}": ${exists ? 'PRESENT (PASS)' : 'MISSING (FAIL)'}`);
      if (!exists) {
        pass = false;
      }
    }

    // Specially handle Prospect vs Lead since local uses Lead
    const hasProspect = actualTables.has('Prospect');
    const hasLead = actualTables.has('Lead');
    console.log(`Table "Prospect": ${hasProspect ? 'PRESENT' : 'MISSING (EXPECTED lead fallback)'}`);
    console.log(`Table "Lead": ${hasLead ? 'PRESENT (PASS)' : 'MISSING'}`);
    if (!hasLead && !hasProspect) {
      console.log('Neither Lead nor Prospect tables found (FAIL)');
      pass = false;
    }

    // 2. ConnectedMailbox column check to detect PR #6 drift
    console.log('\n--- ConnectedMailbox Drift Analysis ---');
    const columnsResult = await prisma.$queryRawUnsafe<{ column_name: string }[]>(
      `SELECT column_name FROM information_schema.columns WHERE table_name = 'ConnectedMailbox'`
    );

    if (columnsResult.length === 0) {
      console.log('ConnectedMailbox table not found. Skipping column analysis.');
      pass = false;
    } else {
      const actualCols = new Set(columnsResult.map((c) => c.column_name));

      // Main columns
      const mainCols = ['assignedUserId', 'email', 'encryptedAccessToken', 'encryptedRefreshToken', 'tokenExpiresAt'];
      // PR #6 columns
      const pr6Cols = ['emailAddress', 'accessTokenEncrypted', 'refreshTokenEncrypted', 'expiresAt'];

      let hasMainCols = true;
      for (const col of mainCols) {
        if (!actualCols.has(col)) {
          hasMainCols = false;
        }
      }

      let hasPR6Cols = true;
      for (const col of pr6Cols) {
        if (!actualCols.has(col)) {
          hasPR6Cols = false;
        }
      }

      console.log('Columns found:', Array.from(actualCols).join(', '));
      if (hasMainCols && !hasPR6Cols) {
        console.log('Verdict: Canonical Main Shape (No Drift, PASS)');
      } else if (hasPR6Cols && !hasMainCols) {
        console.log('Verdict: PR #6 Conflicting Shape (Drift Detected, FAIL)');
        pass = false;
      } else {
        console.log('Verdict: Unknown/Mixed column structure. Manual verification required.');
        pass = false;
      }
    }

    console.log('\n--- Final Verdict ---');
    if (pass) {
      console.log('STATUS: PASS - DB shape matches canonical expectations.');
    } else {
      console.log('STATUS: FAIL - DB shape has missing tables or schema drift.');
    }
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
