import { NextRequest, NextResponse } from "next/server";
import { getCurrentContextFromRequest } from "@/lib/auth";
import fs from "fs";
import path from "path";

export async function GET(req: NextRequest, { params }: { params: { filename: string } }) {
    const { userId } = await getCurrentContextFromRequest(req);
    if (!userId) {
        return new NextResponse("Unauthorized", { status: 401 });
    }

    const { filename } = params;
    // Basic sanitization
    const safeFilename = path.basename(filename);
    const filePath = path.join(process.cwd(), "storage", "exports", safeFilename);

    if (!fs.existsSync(filePath)) {
        return new NextResponse("File not found", { status: 404 });
    }

    const fileBuffer = fs.readFileSync(filePath);

    return new NextResponse(fileBuffer, {
        headers: {
            "Content-Type": "text/csv",
            "Content-Disposition": `attachment; filename="${safeFilename}"`,
        },
    });
}
