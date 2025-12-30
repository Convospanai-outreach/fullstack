import { NextRequest, NextResponse } from "next/server";
import { getCurrentContext } from "@/lib/auth";
import { enforcePolicy } from "@/lib/governance/guard";
import { audit } from "@/lib/governance/audit";

// POST /api/upload/csv - Upload and process CSV file
export async function POST(req: NextRequest) {
  try {
    const { userId, teamId } = await getCurrentContext();
    if (!userId || !teamId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // GOVERNANCE CHECK
    try {
      await enforcePolicy({
        orgId: teamId,
        userId,
        action: "UPLOAD",
      });
    } catch (error: any) {
      return NextResponse.json({ error: error.message }, { status: 403 });
    }

    const contentType = req.headers.get("content-type");

    let csvText: string = "";
    let fieldMapping: any = undefined;

    if (contentType?.includes("application/json")) {
      // JSON payload with CSV text and mapping
      const body = await req.json();
      csvText = body.csv || body.csvText || "";
      fieldMapping = body.fieldMapping;
    } else {
      // Plain text CSV
      csvText = await req.text();
    }

    if (!csvText || csvText.trim() === "") {
      return NextResponse.json(
        { error: "CSV content is required" },
        { status: 400 }
      );
    }

    // Process CSV import
    const { csvIngestionService } = await import("@/modules/csv-ingestion/service/csvIngestionService");
    // @ts-ignore
    const result = await csvIngestionService.processCSV(csvText, teamId, fieldMapping);

    // MANDATORY AUDIT LOG
    await audit({
      actorId: userId,
      orgId: teamId,
      action: "UPLOAD_CSV",
      entity: "Upload",
      metadata: { rowCount: result?.totalParsed || 0, success: result?.success },
    });

    return NextResponse.json({
      ...result,
    });
  } catch (error) {
    console.error("CSV import error:", error);
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "Failed to import CSV",
      },
      { status: 500 }
    );
  }
}
