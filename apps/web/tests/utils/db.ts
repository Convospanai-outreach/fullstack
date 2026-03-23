const testDatabaseUrl = process.env.TEST_DATABASE_URL ?? process.env.DATABASE_URL ?? "";

export const hasTestDatabase = testDatabaseUrl.length > 0;

export const ensureDatabaseUrlEnv = () => {
  if (testDatabaseUrl && !process.env.DATABASE_URL) {
    process.env.DATABASE_URL = testDatabaseUrl;
  }
  return testDatabaseUrl;
};
