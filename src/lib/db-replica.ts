import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";

/**
 * Database client with built-in replica routing capability
 * Currently uses single primary (India), but architected for future global expansion
 * 
 * Future: Will route reads to nearest geographic replica
 */

export type QueryType = 'read' | 'write';
export type Region = 'india' | 'eu' | 'us' | 'apac';

/**
 * Get the appropriate database connection based on query type and user region
 * 
 * Current Implementation: Always returns primary (India)
 * Future: Will route reads to regional replicas
 */
export function getDbClient(_queryType: QueryType = 'read', _region: Region = 'india') {
  // For now, always use the primary Prisma client (India)
  // Future implementation will check process.env for replica URLs

  /* FUTURE IMPLEMENTATION:
  
  if (queryType === 'write') {
    return prisma; // Always write to primary
  }
  
  // Route reads to nearest replica
  switch (region) {
    case 'eu':
      return process.env.DATABASE_REPLICA_EU 
        ? createPrismaClient(process.env.DATABASE_REPLICA_EU)
        : prisma;
    
    case 'us':
      return process.env.DATABASE_REPLICA_US
        ? createPrismaClient(process.env.DATABASE_REPLICA_US)
        : prisma;
    
    case 'apac':
      return process.env.DATABASE_REPLICA_APAC
        ? createPrismaClient(process.env.DATABASE_REPLICA_APAC)
        : prisma;
    
    default:
      return prisma; // India primary
  }
  */

  return prisma;
}

/**
 * Detect user region from IP address or request headers
 * 
 * Current: Returns 'india' (default)
 * Future: Will use geo-IP lookup
 */
export function detectUserRegion(_request?: Request): Region {
  // For now, default to India
  // Future implementation will check CF-IPCountry header or geo-IP service

  /* FUTURE IMPLEMENTATION:
  
  if (!request) return 'india';
  
  const cfCountry = request.headers.get('CF-IPCountry');
  
  if (!cfCountry) {
    // Fallback to IP geolocation service
    const ip = request.headers.get('x-forwarded-for')?.split(',')[0];
    // const geoData = await geoIpLookup(ip);
    // return mapCountryToRegion(geoData.country);
  }
  
  // Map Cloudflare country codes to regions
  const euCountries = ['DE', 'FR', 'GB', 'IT', 'ES', 'NL', 'PL', ...];
  const usCountries = ['US', 'CA', 'MX'];
  const apacCountries = ['IN', 'SG', 'AU', 'JP', 'CN', ...];
  
  if (euCountries.includes(cfCountry)) return 'eu';
  if (usCountries.includes(cfCountry)) return 'us';
  if (apacCountries.includes(cfCountry)) return 'apac';
  
  return 'india'; // Default
  */

  return 'india';
}

/**
 * Smart read helper - automatically routes to optimal replica
 * 
 * Usage:
 * ```typescript
 * const leads = await smartRead((db) => db.lead.findMany({ ... }), request);
 * ```
 */
export async function smartRead<T>(
  operation: (client: typeof prisma) => Promise<T>,
  request?: Request
): Promise<T> {
  const region = detectUserRegion(request);
  const client = getDbClient('read', region);

  // Retry logic for transient errors
  let retries = 3;
  while (retries > 0) {
    try {
      return await operation(client);
    } catch (error: any) {
      const isTransient =
        error?.code === 'P1001' || // Can't reach database server
        error?.code === 'P1008' || // Operations timed out
        error?.code === 'P1017' || // Server closed the connection
        error?.message?.includes('connect') ||
        error?.message?.includes('timeout');

      if (isTransient && retries > 1) {
        console.warn(`[DB SmartRead] Transient error detected (${error.code || 'unknown'}). Retrying... ${retries - 1} left.`);
        retries--;
        await new Promise(r => setTimeout(r, 100 * (4 - retries))); // Backoff: 100ms, 200ms, 300ms
        continue;
      }
      throw error;
    }
  }
  // Should not reach here due to throw
  throw new Error("DB Retry failed");
}

/**
 * Write helper - always uses primary database
 * 
 * Usage:
 * ```typescript
 * const lead = await smartWrite((db) => db.lead.create({ ... }));
 * ```
 */
export async function smartWrite<T>(
  operation: (client: typeof prisma) => Promise<T>
): Promise<T> {
  const client = getDbClient('write');
  return operation(client);
}

/**
 * Health check for database replicas
 * Future: Will check latency and lag for all replicas
 */
export async function checkDatabaseHealth() {
  const health = {
    primary: { healthy: false, latency: 0 },
    replicas: {} as Record<Region, { healthy: boolean; latency: number; lag?: number }>
  };

  try {
    const start = Date.now();
    await prisma.$queryRaw`SELECT 1`;
    const latency = Date.now() - start;

    health.primary = { healthy: true, latency };
  } catch (error) {
    console.error('[DB Health] Primary unhealthy:', error);
  }

  // Future: Check replica health
  /* FUTURE IMPLEMENTATION:
  
  for (const region of ['eu', 'us', 'apac'] as Region[]) {
    try {
      const client = getDbClient('read', region);
      const start = Date.now();
      await client.$queryRaw`SELECT 1`;
      const latency = Date.now() - start;
      
      // Check replication lag
      const lag = await checkReplicationLag(client);
      
      health.replicas[region] = { healthy: true, latency, lag };
    } catch (error) {
      console.error(`[DB Health] ${region} replica unhealthy:`, error);
      health.replicas[region] = { healthy: false, latency: 0 };
    }
  }
  */

  return health;
}

/**
 * Transaction helper - always uses primary
 * 
 * Replicas don't support transactions
 */
export async function transaction<T>(
  operation: (tx: Prisma.TransactionClient) => Promise<T>
): Promise<T> {
  return prisma.$transaction(operation);
}

// Export the default client for backward compatibility
export { prisma };
export default prisma;
