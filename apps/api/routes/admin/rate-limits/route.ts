/**
 * Admin Rate Limit Management API
 * 
 * Provides endpoints to:
 * - View rate limit statistics
 * - Reset rate limits for specific identifiers
 * - Clear all rate limits
 * - Monitor rate limit usage
 */

import { NextRequest, NextResponse } from 'next/server';
import { getCurrentContextFromRequest } from '@/lib/auth';
import { prisma } from '@/lib/db';
import {
  getRateLimitStats,
  getRateLimitStatus,
  resetRateLimit,
  clearAllRateLimits
} from '@/lib/rateLimit';

async function getRateLimitAdminRole(req: NextRequest): Promise<string | null | undefined> {
  const { userId } = await getCurrentContextFromRequest(req);
  if (!userId) return undefined;
  const user = await prisma.user.findUnique({ where: { id: userId }, select: { enterpriseRole: true } });
  return user?.enterpriseRole ?? null;
}

/**
 * GET /api/admin/rate-limits
 * Get overall rate limit statistics
 */
export async function GET(req: NextRequest) {
  try {
    const userRole = await getRateLimitAdminRole(req);

    if (userRole === undefined) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Check if user has admin role
    if (userRole !== 'SYSTEM_ADMIN' && userRole !== 'ORG_ADMIN') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }
    
    const stats = getRateLimitStats();
    
    return NextResponse.json({
      stats,
      message: 'Rate limit statistics retrieved successfully',
    });
  } catch (error) {
    console.error('Error fetching rate limit stats:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

/**
 * POST /api/admin/rate-limits
 * Manage rate limits (reset specific or clear all)
 */
export async function POST(req: NextRequest) {
  try {
    const userRole = await getRateLimitAdminRole(req);

    if (userRole === undefined) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Check if user has admin role
    if (userRole !== 'SYSTEM_ADMIN' && userRole !== 'ORG_ADMIN') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }
    
    const body = await req.json();
    const { action, identifier, endpoint } = body;
    
    if (action === 'reset' && identifier && endpoint) {
      // Reset specific rate limit
      await resetRateLimit(identifier, endpoint);
      
      return NextResponse.json({
        success: true,
        message: `Rate limit reset for ${identifier} on ${endpoint}`,
      });
    } else if (action === 'clear') {
      // Clear all rate limits (use with caution!)
      await clearAllRateLimits();
      
      return NextResponse.json({
        success: true,
        message: 'All rate limits cleared',
      });
    } else if (action === 'status' && identifier && endpoint) {
      // Get status for specific identifier
      const status = await getRateLimitStatus(identifier, endpoint);
      
      return NextResponse.json({
        identifier,
        endpoint,
        status: status || null,
        message: status ? 'Rate limit found' : 'No rate limit active',
      });
    } else {
      return NextResponse.json(
        { error: 'Invalid action or missing parameters' },
        { status: 400 }
      );
    }
  } catch (error) {
    console.error('Error managing rate limits:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
