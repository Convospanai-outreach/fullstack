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
import { getAdminUser } from '@/lib/admin';
import { UserRole } from '@prisma/client';
import {
  getRateLimitStats,
  getRateLimitStatus,
  resetRateLimit,
  clearAllRateLimits
} from '@/lib/rateLimit';

/**
 * GET /api/admin/rate-limits
 * Get overall rate limit statistics
 */
export async function GET(req: NextRequest) {
  try {
    // Rate-limit state is a single process-wide, platform-shared cache with
    // no teamId scoping - ORG_ADMIN is a normal, self-service-assignable
    // per-workspace role (any team owner can invite a teammate as ORG_ADMIN),
    // not a platform-level privilege (see OPEN-124/153/174/205). Only a
    // genuine platform operator (SYSTEM_ADMIN/SUPER_ADMIN) may touch this.
    const admin = await getAdminUser(UserRole.SYSTEM_ADMIN);
    if (!admin) {
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
    const admin = await getAdminUser(UserRole.SYSTEM_ADMIN);
    if (!admin) {
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
