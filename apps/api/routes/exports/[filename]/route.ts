import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import fs from "fs";
import path from "path";

export async function GET(_req: Request, { params }: { params: Promise<{ filename: string }> }) {
    const session = await getServerSession(authOptions);
    if (!session || !session.user?.email) {
        return new NextResponse("Unauthorized", { status: 401 });
    }

    const { filename } = await params;
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
