import { NextResponse } from "next/server";
import { getCurrentContext } from "@/lib/auth";
import { firstResponseSeconds, medianSeconds } from "@/modules/leads/responseTime";

export const dynamic = "force-dynamic";

// Leads created in the last 90 days, newest first, capped so one request stays bounded.
const WINDOW_MS = 90 * 24 * 60 * 60 * 1000;
const MAX_LEADS = 1000;

// Team median of speed to lead for landing-page leads: seconds from creation to the first outbound message.
export async function GET() {
  const { prisma } = await import("@/lib/db");
  const context = await getCurrentContext();
  const teamId = context.teamId;
  if (!teamId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const firstOnly = { orderBy: { createdAt: "asc" as const }, take: 1, select: { createdAt: true } };
  const leads = await prisma.lead.findMany({
    where: { teamId, source: "landing_page", createdAt: { gte: new Date(Date.now() - WINDOW_MS) } },
    orderBy: { createdAt: "desc" },
    take: MAX_LEADS,
    select: {
      createdAt: true,
      emails: firstOnly,
      messages: { ...firstOnly, where: { direction: "OUTBOUND", status: { not: "draft" } } },
      whatsappMessages: { ...firstOnly, where: { direction: "OUTBOUND" } },
    },
  });

  const values = leads.map((lead) =>
    firstResponseSeconds(lead.createdAt, [...lead.emails, ...lead.messages, ...lead.whatsappMessages].map((row) => row.createdAt))
  );
  return NextResponse.json({ medianSeconds: medianSeconds(values), sampleSize: values.filter((v) => v !== null).length });
}
