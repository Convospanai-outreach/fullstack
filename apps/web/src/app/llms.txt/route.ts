import { NextResponse } from "next/server";
import fs from "fs";
import path from "path";

export const dynamic = "force-static";
export const revalidate = 86400; // Cache for 24 hours

export async function GET() {
    try {
        const filePath = path.join(process.cwd(), "public", "llms.txt");
        const content = await fs.promises.readFile(filePath, "utf-8");

        return new NextResponse(content, {
            status: 200,
            headers: {
                "Content-Type": "text/markdown; charset=utf-8",
                "Access-Control-Allow-Origin": "*",
                "Cache-Control": "public, max-age=86400, stale-while-revalidate=3600",
            },
        });
    } catch (error) {
        return new NextResponse("# CraftMyFunnel\n\n> Governed AI-driven B2B outreach and qualified meeting workflow platform.\n", {
            status: 200,
            headers: {
                "Content-Type": "text/markdown; charset=utf-8",
                "Access-Control-Allow-Origin": "*",
            },
        });
    }
}
