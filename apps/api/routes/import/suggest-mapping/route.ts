
import { NextResponse } from "next/server";
import { csvIngestionService } from "@/modules/csv-ingestion/service/csvIngestionService"; // Fixed casing import
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";

// Parse headers from file logic is tricky in API route without full upload.
// Assuming client sends headers for suggestion.
export async function POST(req: Request) {
    const session = await getServerSession(authOptions);
    if (!session) return new NextResponse("Unauthorized", { status: 401 });

    const { headers } = await req.json();

    try {
        const mapping = await csvIngestionService.suggestMapping(headers);
        return NextResponse.json({ success: true, mapping });
    } catch (error: any) {
        return NextResponse.json({ success: false, error: error.message }, { status: 500 });
    }
}
