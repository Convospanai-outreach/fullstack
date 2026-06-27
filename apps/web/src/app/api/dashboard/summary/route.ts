/**
 * Required environment variables for this route:
 * - CLERK_SECRET_KEY (Clerk auth)
 * - NEXT_PUBLIC_SUPABASE_URL (Supabase connection)
 * - SUPABASE_SERVICE_ROLE_KEY (server-side Supabase queries)
 *
 * Set these in: Vercel → Project Settings → Environment Variables
 * For Railway services: RAILWAY_API_URL (if calling Railway background jobs)
 */

import { NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';

export async function GET() {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  // TODO: Replace with real Supabase queries
  // Query pattern:
  //   const supabase = createServerClient()
  //   const { data: leads } = await supabase.from('leads').select('id').eq('user_id', userId)
  //   const { data: meetings } = await supabase.from('meetings')
  //     .select('id, created_at').eq('user_id', userId)
  //     .gte('created_at', startOfWeek.toISOString())

  return NextResponse.json({
    kpis: {
      meetingsBooked: 14,
      meetingsDelta: 3,
      activeLeads: 148,
      draftsReady: 43,
      draftsPendingSend: 8,
      openRatePct: 34,
      openRateDelta: 4,
    },
    workflow: {
      leadsImported: true,
      leadsCount: 148,
      draftsGenerated: true,
      draftsCount: 43,
      followUpsReviewed: true,
      followUpsCount: 12,
      pendingSendCount: 8,
    },
    recentActivity: [
      { id: '1', type: 'meeting_booked', description: 'Meeting booked — Liam Torres, DataBridge Inc', timestamp: new Date(Date.now() - 3600000).toISOString() },
      { id: '2', type: 'draft_generated', description: 'Draft generated — Priya Sharma, Acme Corp', timestamp: new Date(Date.now() - 7200000).toISOString() },
      { id: '3', type: 'follow_up_flagged', description: 'Follow-up flagged — Nova Analytics', timestamp: new Date(Date.now() - 10800000).toISOString() },
      { id: '4', type: 'campaign_activated', description: 'Campaign "Q3 SaaS" activated', timestamp: new Date(Date.now() - 86400000).toISOString() },
    ],
    setupPercent: 62,
  });
}
