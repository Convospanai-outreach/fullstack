import { NextResponse } from "next/server";
import { helpService } from "@/modules/help/service/HelpService";

export async function GET(req: Request) {
    const { searchParams } = new URL(req.url);
    const query = searchParams.get("q");

    if (query) {
        const results = await helpService.search(query);
        return NextResponse.json(results);
    } else {
        // Return popular or all
        const results = await helpService.downloadAll();
        return NextResponse.json(results);
    }
}
